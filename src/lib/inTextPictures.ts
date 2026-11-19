/**
 * In-text pictures for the article API's contentHtml.
 *
 * Articles place pictures between paragraphs as Lexical `upload` nodes. The
 * Posts editor registers no upload feature, so Payload never populates them:
 * the node's `value` stays a bare media id at any depth, and the stock
 * converter renders a bare id as nothing. This reads every picture of an
 * article in one query and renders each as a plain figure.
 *
 * No `@/` imports, so the unit test can load this file directly.
 */

/** The media fields a picture needs (a subset of the Media collection). */
export type MediaDoc = {
  id: number | string
  url?: string | null
  alt?: string | null
  mimeType?: string | null
  width?: number | null
  height?: number | null
  sizes?: Record<string, { url?: string | null; width?: number | null } | null | undefined> | null
}

type Node = { type?: string; relationTo?: string; value?: unknown; children?: Node[] }
type Content = { root?: Node } | null | undefined

const isId = (v: unknown): v is number | string => typeof v === 'number' || typeof v === 'string'

/** The media id of an `upload` node's value. A stored object is never trusted
 * as the media itself: it came from whoever wrote the post, not from Payload,
 * so only its id is used and the doc is always the one read from the database. */
const idOf = (value: unknown): number | string | undefined => {
  const id = value && typeof value === 'object' ? (value as { id?: unknown }).id : value
  return isId(id) ? id : undefined
}

/** Positive whole number, or undefined: width/height go into attributes. */
const px = (v: unknown): number | undefined => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined
}

/** Ids of every in-text picture, at any depth, without repeats. */
export const uploadIds = (content: Content): (number | string)[] => {
  const ids = new Set<number | string>()
  const walk = (node: Node | undefined) => {
    if (!node) return
    const id = node.type === 'upload' && node.relationTo === 'media' ? idOf(node.value) : undefined
    if (id !== undefined) ids.add(id)
    node.children?.forEach(walk)
  }
  walk(content?.root)
  return [...ids]
}

// Variants with the original's aspect ratio (Media.ts). `thumbnail` is too
// small to be worth listing and `square` is cropped.
const SRCSET_SIZES = ['small', 'medium', 'large', 'xlarge']

/** The article column on the site is max-w-2xl (672px): a phone picks the
 * 600w or 900w file. Known limit: a wider column only means a larger file. */
const IMG_SIZES = '(max-width: 672px) 100vw, 672px'

const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A media doc as a figure, or '' when it is not an in-text picture: no doc
 * (deleted media), not an image, or a URL that is neither https nor the public
 * site's own origin (which is http on a local build). Media URLs are relative
 * and resolve against the public site, which proxies /api/media to the CMS.
 * Known limit: captions are not shown. */
export const figure = (doc: MediaDoc | null | undefined, origin: string): string => {
  if (!doc || !doc.mimeType?.startsWith('image/')) return ''
  const own = new URL(origin).origin
  const safe = (url: string | null | undefined): string | null => {
    if (!url) return null
    try {
      const u = new URL(url, origin)
      return u.protocol === 'https:' || u.origin === own ? u.toString() : null
    } catch {
      return null
    }
  }
  const src = safe(doc.url)
  if (!src) return ''
  const candidates = [
    ...SRCSET_SIZES.map((name) => doc.sizes?.[name]).map((s) => ({ url: safe(s?.url), width: px(s?.width) })),
    { url: src, width: px(doc.width) },
  ].filter((c): c is { url: string; width: number } => !!c.url && !!c.width)

  const attrs = [`src="${escapeAttr(src)}"`]
  if (candidates.length > 1) {
    const srcset = candidates.map((c) => `${c.url} ${c.width}w`).join(', ')
    attrs.push(`srcset="${escapeAttr(srcset)}"`, `sizes="${IMG_SIZES}"`)
  }
  attrs.push(`alt="${escapeAttr(doc.alt ?? '')}"`)
  const width = px(doc.width)
  const height = px(doc.height)
  if (width && height) attrs.push(`width="${width}"`, `height="${height}"`)
  attrs.push('loading="lazy"', 'decoding="async"')
  return `<figure><img ${attrs.join(' ')} /></figure>`
}

/**
 * Reads the article's pictures in one query and returns the renderer for an
 * `upload` node's value. A failed read is reported to `onError` and the
 * article renders without those pictures: the consumers are a live site and
 * its edge functions, where a 500 would take the whole article down.
 */
export const inTextPictures = async (
  content: Content,
  findMedia: (ids: (number | string)[]) => Promise<MediaDoc[]>,
  origin: string,
  onError: (err: unknown) => void,
): Promise<(value: unknown) => string> => {
  const ids = uploadIds(content)
  let docs: MediaDoc[] = []
  if (ids.length) {
    try {
      docs = await findMedia(ids)
    } catch (err) {
      onError(err)
    }
  }
  const byId = new Map(docs.map((d) => [String(d.id), d]))
  return (value) => {
    const id = idOf(value)
    return figure(id === undefined ? undefined : byId.get(String(id)), origin)
  }
}
