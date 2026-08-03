/**
 * Import articles from the Supabase backup JSON into Payload. Run with:
 *
 *   pnpm payload run ./scripts/import-articles.ts -- --limit 5
 *
 * Reads the dated backup produced by the pre-migration snapshot (article rows
 * + mirrored images) and creates categories, media and published posts via the
 * Local API. Idempotent: rows whose slug already exists are skipped, so it can
 * resume after a partial run.
 *
 * It WRITES to the database, so it refuses to run unless DATABASE_URI is
 * local. A production run must pass --allow-remote deliberately.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { convertHTMLToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { JSDOM } from 'jsdom'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const BACKUP = 'C:/Dev/digital-horizon/backups/2026-08-03'
const SITE_DOMAIN = process.env.IMPORT_DOMAIN || '2ahealthylife.com'
const SOURCE_JSON = `${BACKUP}/supabase/generated_content-${SITE_DOMAIN === 'heelvrijeten.nl' ? 'heelvrijeten' : '2ahealthylife'}.json`
const IMAGES_ROOT = `${BACKUP}/images/${SITE_DOMAIN}`

const args = process.argv.slice(2)
const limitArg = args.indexOf('--limit')
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity
const ALLOW_REMOTE = args.includes('--allow-remote')

const uri = process.env.DATABASE_URI ?? ''
const isLocal = uri.includes('localhost') || uri.includes('127.0.0.1')
if (!isLocal && !ALLOW_REMOTE) {
  throw new Error(`DATABASE_URI is not local (${uri.replace(/:[^:@/]+@/, ':***@')}). Pass --allow-remote for a deliberate production run.`)
}

/** "https://<site>/images/x.webp" or "/images/x.webp" → local mirrored file, or null. */
function mirroredFile(ref: string | null): string | null {
  if (!ref) return null
  const m = ref.match(/\/images\/(.+?)(\?|$)/)
  if (!m) return null
  const p = path.join(IMAGES_ROOT, decodeURIComponent(m[1]))
  return fs.existsSync(p) && fs.statSync(p).size > 0 ? p : null
}

const run = async () => {
  console.log(`import-articles: domain=${SITE_DOMAIN} limit=${LIMIT} db=${uri.replace(/:[^:@/]+@/, ':***@')}`)
  const payload = await getPayload({ config })
  console.log('payload initialized')
  const editorConfig = await editorConfigFactory.default({ config: payload.config })

  const rows = JSON.parse(fs.readFileSync(SOURCE_JSON, 'utf8')) as any[]
  rows.sort((a, b) => (a.published_at ?? '').localeCompare(b.published_at ?? ''))

  const stats = { created: 0, skippedExisting: 0, noSlug: 0, heroMissing: 0, inlineImgs: 0, inlineDropped: 0, failed: [] as string[] }
  const categoryCache = new Map<string, number>()
  const mediaCache = new Map<string, number>()

  /** Create (or reuse) a media doc for an image reference; null if the file is not in the mirror. */
  const ensureMedia = async (ref: string | null, alt: string): Promise<number | null> => {
    const file = mirroredFile(ref)
    if (!file) return null
    const cached = mediaCache.get(file)
    if (cached) return cached
    const media = await payload.create({ collection: 'media', data: { alt }, filePath: file })
    mediaCache.set(file, media.id as number)
    return media.id as number
  }

  /**
   * The HTML converter emits inline <img> as upload nodes stuck in `pending`
   * (the editor's paste flow) — and the site's serializer has no upload case,
   * so they render as nothing. Replace each with a mediaBlock node (which the
   * serializer already renders), and drop the ones whose file is broken in
   * production.
   */
  const resolvePendingUploads = async (node: any, alt: string): Promise<void> => {
    if (Array.isArray(node?.children)) {
      const kept: any[] = []
      for (const child of node.children) {
        if (child?.type === 'upload' && child.pending?.src) {
          const id = await ensureMedia(child.pending.src, alt)
          if (id == null) {
            stats.inlineDropped++
            continue
          }
          kept.push({
            type: 'block',
            fields: { id: randomUUID().replace(/-/g, '').slice(0, 24), blockType: 'mediaBlock', media: id },
            format: '',
            version: 2,
          })
        } else {
          await resolvePendingUploads(child, alt)
          kept.push(child)
        }
      }
      node.children = kept
    }
  }

  const categoryId = async (title: string): Promise<number> => {
    const cached = categoryCache.get(title)
    if (cached) return cached
    const found = await payload.find({ collection: 'categories', where: { title: { equals: title } }, limit: 1 })
    const doc = found.docs[0] ?? (await payload.create({ collection: 'categories', data: { title } }))
    categoryCache.set(title, doc.id as number)
    return doc.id as number
  }

  let processed = 0
  for (const row of rows) {
    if (processed >= LIMIT) break
    if (!row.slug) {
      stats.noSlug++
      continue
    }
    // Source slugs are nested paths (category/subcategory/article). The live
    // SPA already serves the flat /blog/<article> form, and last segments are
    // unique across both sites (verified 390/390 and 180/180), so the post
    // slug is the last segment. Old nested URLs get a patterned redirect at
    // front-end switchover.
    const slug = String(row.slug).split('/').pop() as string
    const existing = await payload.find({ collection: 'posts', where: { slug: { equals: slug } }, limit: 1 })
    if (existing.docs.length) {
      stats.skippedExisting++
      continue
    }
    processed++
    try {
      const heroId = await ensureMedia(row.main_image, row.title)
      if (heroId == null && row.main_image) stats.heroMissing++

      const html: string = row.content_html || `<p>${row.content ?? ''}</p>`
      stats.inlineImgs += (html.match(/<img\s/g) ?? []).length

      const content = convertHTMLToLexical({ editorConfig, html, JSDOM })
      await resolvePendingUploads(content.root, row.title)

      const cats: number[] = []
      if (row.category) cats.push(await categoryId(row.category))

      await payload.create({
        collection: 'posts',
        context: { disableRevalidate: true },
        data: {
          title: row.title,
          slug,
          _status: 'published',
          publishedAt: row.published_at ?? row.created_at ?? new Date().toISOString(),
          categories: cats,
          content: content as never,
          meta: {
            title: row.meta_title || row.title,
            description: row.meta_description || row.summary || undefined,
            image: heroId ?? undefined,
          },
        },
      })
      stats.created++
      if (stats.created % 25 === 0) payload.logger.info(`created ${stats.created}...`)
    } catch (e) {
      stats.failed.push(`${row.slug}: ${(e as Error).message.slice(0, 200)}`)
    }
  }

  payload.logger.info(`IMPORT DONE ${JSON.stringify(stats, null, 2)}`)
  process.exit(0)
}

// Top-level await is required: `payload run` exits the process the moment the
// module finishes evaluating, so a fire-and-forget run() dies mid-import.
try {
  await run()
} catch (e) {
  console.error('IMPORT FAILED:', e)
  process.exit(1)
}
