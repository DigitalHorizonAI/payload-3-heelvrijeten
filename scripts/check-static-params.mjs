/**
 * generateStaticParams must never hand Next a param without a slug.
 *
 *   node scripts/check-static-params.mjs
 *
 * On 4 Sep the newwebsite.builders CMS could not deploy for eleven hours:
 *
 *   Error: A required parameter (slug) was not provided as a string received
 *   undefined in generateStaticParams for /blog/[slug]
 *
 * The route mapped every post straight to { slug } with no filter, so one post
 * without a slug stopped the whole build. This site is single-locale, so it
 * cannot arrive the way it did there - a translated article missing a locale -
 * but the slug field is not required and articles arrive over the API, so a
 * post can still reach the route without one.
 */
import assert from 'assert'
import fs from 'fs'
import path from 'path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const ROUTE = path.join(ROOT, 'src', 'app', '(frontend)', 'blog', '[slug]', 'page.tsx')
const CMS = (process.env.CMS_URL || 'https://cms.heelvrijeten.nl').replace(/\/$/, '')

let failures = 0
const check = (name, fn) => {
  try {
    fn()
    console.log(`  ok    ${name}`)
  } catch (e) {
    failures++
    console.log(`  FAIL  ${name}\n        ${e.message}`)
  }
}

console.log('static params:')

const source = fs.readFileSync(ROUTE, 'utf8')
const body = source.slice(source.indexOf('generateStaticParams'), source.indexOf('type Args'))

check('the route filters posts without a slug', () =>
  assert.ok(
    /\.filter\(/.test(body) && /slug/.test(body),
    'generateStaticParams maps posts straight to { slug } - one slugless post reds the build',
  ),
)

// Mirrors the route's own query: published only, no elevated access, same limit.
const response = await fetch(`${CMS}/api/posts?limit=1000&depth=0`)
assert.ok(response.ok, `the CMS answered ${response.status}`)
const { docs, totalDocs } = await response.json()

// Built the way the route builds it, not the way it ought to - otherwise this
// applies its own fix to the data and passes against code that would still
// red the deploy.
const routeFilters = /\.filter\(/.test(body)
const kept = routeFilters ? docs.filter(({ slug }) => typeof slug === 'string' && slug) : docs
const params = kept.map(({ slug }) => ({ slug }))

console.log(
  `  ${totalDocs} published, ${params.length} params, ${docs.length - kept.length} skipped` +
    (routeFilters ? '' : ' (route has no filter - params built unfiltered)'),
)
for (const doc of docs.filter(({ slug }) => typeof slug !== 'string' || !slug)) {
  console.log(`        id=${doc.id} has no slug`)
}

check('every param Next receives carries a non-empty string slug', () =>
  assert.ok(
    params.every(({ slug }) => typeof slug === 'string' && slug.length > 0),
    `${params.filter(({ slug }) => !slug).length} param(s) have no slug - the exact input Next refuses`,
  ),
)

// The route asks for 1000. Past that it truncates in silence.
check(`fewer than 1000 published posts (${totalDocs})`, () =>
  assert.ok(totalDocs < 1000, `${totalDocs} posts - the route's limit of 1000 now truncates`),
)

if (failures) {
  console.log(`\n${failures} failed.`)
  process.exit(1)
}
console.log('\nOK.')
