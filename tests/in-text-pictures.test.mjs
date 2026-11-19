// In-text pictures in the article API's contentHtml: Lexical `upload` nodes,
// which Payload leaves as bare media ids at any depth.
// Run: node --test tests/in-text-pictures.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'

// A namespace import, so a missing export fails its own tests instead of the whole file.
import * as P from '../src/lib/inTextPictures.ts'

const ORIGIN = 'https://site.example.test'

const media = (id, extra = {}) => ({
  id,
  url: `/api/media/file/p${id}.webp`,
  alt: `Picture ${id}`,
  mimeType: 'image/webp',
  width: 1408,
  height: 768,
  sizes: {
    thumbnail: { url: `/api/media/file/p${id}-300x164.webp`, width: 300 },
    square: { url: `/api/media/file/p${id}-500x500.webp`, width: 500 },
    small: { url: `/api/media/file/p${id}-600x327.webp`, width: 600 },
    medium: { url: `/api/media/file/p${id}-900x491.webp`, width: 900 },
    large: { url: `/api/media/file/p${id}-1400x764.webp`, width: 1400 },
    xlarge: { url: null, width: null },
  },
  ...extra,
})
const para = (text) => ({ type: 'paragraph', children: [{ type: 'text', text }] })
const upload = (value) => ({ type: 'upload', relationTo: 'media', value, fields: null })
const body = (...children) => ({ root: { type: 'root', children } })

/** A findMedia over `docs` that records every call. */
const finder = (docs) => {
  const calls = []
  const find = async (ids) => {
    calls.push(ids)
    return docs.filter((d) => ids.map(String).includes(String(d.id)))
  }
  return { find, calls }
}
const noError = (err) => assert.fail(`unexpected error: ${err}`)

test('a bare id renders as a figure with srcset, alt, width and height', async () => {
  const { find } = finder([media(491)])
  const render = await P.inTextPictures(body(upload(491)), find, ORIGIN, noError)
  const f = `${ORIGIN}/api/media/file/p491`
  assert.equal(
    render(491),
    `<figure><img src="${f}.webp" srcset="${f}-600x327.webp 600w, ${f}-900x491.webp 900w, ` +
      `${f}-1400x764.webp 1400w, ${f}.webp 1408w" sizes="(max-width: 672px) 100vw, 672px" ` +
      `alt="Picture 491" width="1408" height="768" loading="lazy" decoding="async" /></figure>`,
  )
})

test('three pictures cost one media read; no pictures cost none', async () => {
  const many = finder([media(1), media(2), media(3)])
  const content = body(upload(1), para('x'), upload(2), { type: 'list', children: [upload(3)] }, upload(1))
  await P.inTextPictures(content, many.find, ORIGIN, noError)
  assert.deepEqual(many.calls, [[1, 2, 3]])

  const none = finder([])
  await P.inTextPictures(body(para('only text')), none.find, ORIGIN, noError)
  assert.deepEqual(none.calls, [])
})

test('a stored object value is resolved by its id, never trusted as the media', async () => {
  const forged = media(7, { url: '/api/media/file/forged.webp', width: '1" onerror="x', alt: 'forged' })
  const { find, calls } = finder([media(7)])
  const render = await P.inTextPictures(body(upload(forged)), find, ORIGIN, noError)
  assert.deepEqual(calls, [[7]])
  const html = render(forged)
  assert.match(html, /src="https:\/\/site\.example\.test\/api\/media\/file\/p7\.webp"/)
  assert.doesNotMatch(html, /forged|onerror/)
})

test('non-numeric width or height in a media doc is left out, not interpolated', async () => {
  const doc = media(9, { width: '1" onerror="x', height: 768, sizes: null })
  const render = await P.inTextPictures(body(upload(9)), finder([doc]).find, ORIGIN, noError)
  assert.equal(
    render(9),
    `<figure><img src="${ORIGIN}/api/media/file/p9.webp" alt="Picture 9" loading="lazy" decoding="async" /></figure>`,
  )
})

test('deleted media renders nothing', async () => {
  const render = await P.inTextPictures(body(upload(999)), finder([]).find, ORIGIN, noError)
  assert.equal(render(999), '')
})

test('media without alt gets an empty alt; alt is escaped', async () => {
  const docs = [media(1, { alt: null }), media(2, { alt: 'A "quoted" <b>' })]
  const render = await P.inTextPictures(body(upload(1), upload(2)), finder(docs).find, ORIGIN, noError)
  assert.match(render(1), / alt="" /)
  assert.match(render(2), / alt="A &quot;quoted&quot; &lt;b&gt;" /)
})

test('a non-image upload renders nothing', async () => {
  const pdf = media(3, { mimeType: 'application/pdf', url: '/api/media/file/doc.pdf', sizes: null })
  const render = await P.inTextPictures(body(upload(3)), finder([pdf]).find, ORIGIN, noError)
  assert.equal(render(3), '')
})

test('a URL that is neither https nor the site origin renders nothing', async () => {
  const docs = [
    media(4, { url: 'http://elsewhere.example/p.webp' }),
    media(5, { url: 'javascript:alert(1)' }),
  ]
  const render = await P.inTextPictures(body(upload(4), upload(5)), finder(docs).find, ORIGIN, noError)
  assert.equal(render(4), '')
  assert.equal(render(5), '')
  // The site's own origin is allowed over http (a local build).
  const local = await P.inTextPictures(body(upload(6)), finder([media(6)]).find, 'http://localhost:3000', noError)
  assert.match(local(6), /src="http:\/\/localhost:3000\/api\/media\/file\/p6\.webp"/)
})

test('without size variants: a plain src and no srcset', async () => {
  const doc = media(8, { sizes: null, width: 1, height: 1 })
  const render = await P.inTextPictures(body(upload(8)), finder([doc]).find, ORIGIN, noError)
  assert.equal(
    render(8),
    `<figure><img src="${ORIGIN}/api/media/file/p8.webp" alt="Picture 8" width="1" height="1" loading="lazy" decoding="async" /></figure>`,
  )
})

test('a failed media read is reported and renders the article without those pictures', async () => {
  const errors = []
  const failing = async () => {
    throw new Error('connection terminated')
  }
  const render = await P.inTextPictures(body(upload(1), upload(2)), failing, ORIGIN, (e) => errors.push(e))
  assert.equal(render(1), '')
  assert.equal(render(2), '')
  assert.equal(errors.length, 1)
  assert.equal(errors[0].message, 'connection terminated')
})
