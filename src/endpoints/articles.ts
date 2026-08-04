/**
 * Public read-only article API.
 *
 *   GET /api/articles           listing data only
 *   GET /api/articles/:slug     full article, SEO metadata and related posts
 *
 * Payload already serves /api/posts, which works and stays available. These
 * exist so anything consuming the blog gets a small, stable shape that does
 * not change when the CMS structure does — the fields inside a Post are ours
 * to rearrange, the fields in this response are a contract.
 *
 * Published only, always: `_status` is filtered explicitly AND access control
 * is left on, so a draft cannot leak through either route.
 */
import type { Endpoint, PayloadRequest } from 'payload'
import type { Category, Media, Post } from '@/payload-types'

import { convertLexicalToHTMLAsync } from '@payloadcms/richtext-lexical/html-async'

import { getDocPath } from '@/utilities/collectionPrefixMap'
import { getPublicSiteURL } from '@/utilities/getURL'

const MAX_LIMIT = 50
const DEFAULT_LIMIT = 12

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/**
 * Absolute URL of an uploaded image, or null when none is set. The relation is
 * a bare ID when it hasn't been populated, hence the object check.
 */
const imageURL = (image: unknown): string | null => {
  if (!image || typeof image !== 'object') return null
  const url = (image as Media).url
  return url ? new URL(url, getPublicSiteURL()).toString() : null
}

const titles = (docs: unknown): string[] =>
  Array.isArray(docs)
    ? docs
        .filter((d): d is Category => typeof d === 'object' && d !== null)
        .map((d) => d.title)
        .filter(Boolean)
    : []

/**
 * The listing shape. Deliberately small — a client rendering an index should
 * not have to download every article's body to draw a list of cards.
 */
/**
 * Where the article lives on the public website. Articles that predate the CMS
 * keep the nested path they were already indexed under — changing 400 ranking
 * URLs is not something a CMS migration should do silently. New articles have
 * no legacy path and use the slug.
 */
const publicPath = (post: Post) =>
  post.legacyPath ? `/blog/${String(post.legacyPath).replace(/^\/+/, '')}` : getDocPath('posts', post.slug)

const toListing = (post: Post) => ({
  title: post.title,
  slug: post.slug,
  path: publicPath(post),
  // The SEO description doubles as the excerpt; there is no separate field.
  excerpt: post.meta?.description ?? null,
  publishedAt: post.publishedAt ?? null,
  coverImage: imageURL(post.meta?.image),
  categories: titles(post.categories),
  url: `${getPublicSiteURL()}${getDocPath('posts', post.slug)}`,
  meta: {
    title: post.meta?.title ?? post.title,
    description: post.meta?.description ?? null,
  },
})

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Images inside article bodies are `mediaBlock` nodes, so the stock converters
 * emit nothing for them. Renders each as a plain figure — the consumers of this
 * API are a React site and two Deno edge functions, none of which can run
 * Payload's own React block components.
 */
const mediaBlockConverters = (payload: PayloadRequest['payload']) =>
  (({ defaultConverters }) => ({
    ...defaultConverters,
    blocks: {
      mediaBlock: async ({ node }) => {
        let media = (node.fields as { media?: unknown })?.media
        // Depth normally populates this, but a bare ID must still render an
        // image rather than silently dropping it out of the article.
        if (typeof media === 'number' || typeof media === 'string') {
          media = await payload
            .findByID({ collection: 'media', id: media, depth: 0 })
            .catch(() => null)
        }
        const url = imageURL(media)
        if (!url) return ''
        const alt = typeof media === 'object' && media ? ((media as Media).alt ?? '') : ''
        return `<figure><img src="${escape(url)}" alt="${escape(alt)}" loading="lazy" /></figure>`
      },
    },
  })) as Parameters<typeof convertLexicalToHTMLAsync>[0]['converters']

/**
 * The body as HTML. The websites render article bodies as HTML today and the
 * edge functions that make them indexable read HTML too, so converting here
 * once keeps a Lexical renderer out of all four consumers. `content` stays on
 * the response for anything that wants the structured form.
 */
const contentHTML = async (post: Post, payload: PayloadRequest['payload']): Promise<string> => {
  if (!post.content) return ''
  return convertLexicalToHTMLAsync({
    converters: mediaBlockConverters(payload),
    data: post.content as Parameters<typeof convertLexicalToHTMLAsync>[0]['data'],
  })
}

/** The listing shape plus everything needed to render the article itself. */
const toArticle = (post: Post) => ({
  ...toListing(post),
  content: post.content,
  authors: (post.populatedAuthors ?? []).map((a) => a.name).filter(Boolean),
  canonicalUrl: `${getPublicSiteURL()}${getDocPath('posts', post.slug)}`,
  updatedAt: post.updatedAt ?? null,
  relatedPosts: Array.isArray(post.relatedPosts)
    ? post.relatedPosts
        .filter((p): p is Post => typeof p === 'object' && p !== null)
        .map(toListing)
    : [],
})

const publishedOnly = { _status: { equals: 'published' } }

export const articlesListEndpoint: Endpoint = {
  path: '/articles',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const { limit, page, category } = req.query as Record<string, string | undefined>

    // A caller asking for 10,000 articles should get a sane page, not a
    // timeout. Anything unparseable falls back to the default.
    const parsedLimit = Number.parseInt(limit ?? '', 10)
    const parsedPage = Number.parseInt(page ?? '', 10)

    const result = await req.payload.find({
      collection: 'posts',
      depth: 1,
      draft: false,
      overrideAccess: false,
      limit: Number.isFinite(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
        : DEFAULT_LIMIT,
      page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
      sort: '-publishedAt',
      // ponytail: matches on category title because Categories has no slug
      // field — `like` is ILIKE on Postgres, so ?category=automation works
      // regardless of case. Add a slug to Categories if exact matching or
      // stable URLs for category pages are ever needed.
      where: category
        ? { and: [publishedOnly, { 'categories.title': { like: category } }] }
        : publishedOnly,
    })

    return json({
      docs: result.docs.map(toListing),
      totalDocs: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    })
  },
}

export const articleBySlugEndpoint: Endpoint = {
  path: '/articles/:slug',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const slug = req.routeParams?.slug

    if (typeof slug !== 'string' || !slug) {
      return json({ error: 'A slug is required.' }, 400)
    }

    const result = await req.payload.find({
      collection: 'posts',
      depth: 2, // one level deeper: related posts need their own cover images
      draft: false,
      overrideAccess: false,
      limit: 1,
      pagination: false,
      where: { and: [publishedOnly, { slug: { equals: slug } }] },
    })

    const post = result.docs[0]

    // Unknown and draft slugs are indistinguishable on purpose — a 404 on a
    // draft would confirm the article exists before it is published.
    if (!post) return json({ error: 'Article not found.' }, 404)

    return json({ ...toArticle(post), contentHtml: await contentHTML(post, req.payload) })
  },
}
