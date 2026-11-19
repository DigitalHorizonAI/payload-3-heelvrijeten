import { expect, test } from '@playwright/test'

import { adminAuthHeader } from './admin'
import { baseURL } from './env'

/**
 * Pictures placed between paragraphs must reach the article API's contentHtml.
 *
 * On 18-19 Nov new articles carried in-text `upload` nodes (post 311: three, as
 * bare media ids) and the API's contentHtml had no <img> at all, so the
 * published pages showed only the cover.
 *
 * Four pictures go in: one with alt, one without, a PDF and one whose media was
 * deleted. Only the first two may come out, each at its place, and the
 * endpoint must still answer 200. A mediaBlock picture (older articles) must
 * still render as before.
 */

// 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
)

const text = (value: string) => ({
  type: 'text',
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text: value,
  version: 1,
})
const paragraph = (value: string) => ({
  type: 'paragraph',
  format: '',
  indent: 0,
  version: 1,
  direction: 'ltr',
  textFormat: 0,
  children: [text(value)],
})
const upload = (id: number) => ({
  type: 'upload',
  version: 3,
  format: '',
  relationTo: 'media',
  value: id,
  fields: null,
})
const mediaBlock = (id: number) => ({
  type: 'block',
  version: 2,
  format: '',
  fields: { id: 'e2e-media-block', blockName: '', blockType: 'mediaBlock', media: id },
})
const content = (...children: unknown[]) => ({
  root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children },
})

let adminAuth: string
const mediaIds: number[] = []
const postIds: number[] = []

test.afterAll(async ({ request }) => {
  const headers = { Authorization: adminAuth }
  for (const id of postIds) await request.delete(`/api/posts/${id}`, { headers })
  for (const id of mediaIds) await request.delete(`/api/media/${id}`, { headers })
})

test('contentHtml carries each in-text picture between its paragraphs', async ({ request }) => {
  adminAuth = await adminAuthHeader(request)
  const headers = { Authorization: adminAuth }

  const addMedia = async (name: string, mimeType: string, buffer: Buffer, alt?: string) => {
    const res = await request.post('/api/media', {
      headers,
      multipart: { file: { name, mimeType, buffer }, _payload: JSON.stringify(alt ? { alt } : {}) },
    })
    expect(res.ok(), await res.text()).toBe(true)
    const id: number = (await res.json()).doc.id
    mediaIds.push(id)
    return id
  }
  const addPost = async (title: string, body: unknown) => {
    const res = await request.post('/api/posts', {
      headers,
      data: { title, _status: 'published', content: body },
    })
    expect(res.ok(), await res.text()).toBe(true)
    const doc = (await res.json()).doc
    postIds.push(doc.id)
    return doc.slug as string
  }
  const contentHtml = async (slug: string) => {
    const res = await request.get(`/api/articles/${slug}`)
    expect(res.status()).toBe(200)
    // Payload wraps the converted body in one container div.
    return ((await res.json()).contentHtml as string)
      .trim()
      .replace(/^<div class="payload-richtext">([\s\S]*)<\/div>$/, '$1')
  }

  const withAlt = await addMedia('inline-images-e2e-a.png', 'image/png', PNG, 'A "quoted" picture')
  const noAlt = await addMedia('inline-images-e2e-b.png', 'image/png', PNG)
  const pdf = await addMedia('inline-images-e2e.pdf', 'application/pdf', PDF, 'a document')
  const gone = await addMedia('inline-images-e2e-gone.png', 'image/png', PNG, 'deleted')
  const block = await addMedia('inline-images-e2e-block.png', 'image/png', PNG, 'block picture')

  const slug = await addPost(
    'INLINE IMAGES E2E',
    content(
      paragraph('first'),
      upload(withAlt),
      paragraph('second'),
      upload(noAlt),
      paragraph('third'),
      upload(pdf),
      upload(gone),
      paragraph('fourth'),
    ),
  )

  const del = await request.delete(`/api/media/${gone}`, { headers })
  expect(del.ok(), await del.text()).toBe(true)
  mediaIds.splice(mediaIds.indexOf(gone), 1)

  const html = await contentHtml(slug)
  const picture = (alt: string) =>
    `<figure><img src="[^"]+" alt="${alt}" width="1" height="1" loading="lazy" decoding="async" /></figure>`
  expect(html).toMatch(
    new RegExp(
      `^<p>first</p>${picture('A &quot;quoted&quot; picture')}<p>second</p>${picture('')}` +
        `<p>third</p><p>fourth</p>$`,
    ),
  )

  // The URLs are on the public site, which proxies /api/media to this app, so
  // each path must serve the image here.
  const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1])
  expect(srcs.map((s) => new URL(s).pathname)).toEqual([
    '/api/media/file/inline-images-e2e-a.png',
    '/api/media/file/inline-images-e2e-b.png',
  ])
  for (const src of srcs) {
    const file = await request.get(`${baseURL}${new URL(src).pathname}`)
    expect(file.status(), `GET ${src}`).toBe(200)
    expect(file.headers()['content-type']).toMatch(/^image\//)
  }

  // Older articles use mediaBlock pictures: unchanged.
  const blockSlug = await addPost('INLINE IMAGES E2E BLOCK', content(paragraph('a'), mediaBlock(block)))
  expect(await contentHtml(blockSlug)).toMatch(
    /^<p>a<\/p><figure><img src="[^"]+inline-images-e2e-block\.png" alt="block picture" loading="lazy" \/><\/figure>$/,
  )
})
