/**
 * Fails if any collection lets an API key or an editor do something it should not.
 *
 *   pnpm check:access
 *
 * Needs no database, no browser and no server — it loads the config and calls
 * the access functions directly, so it runs in about a second and can be run
 * before every push.
 *
 * ## Why this is behavioural rather than a check for "undeclared" rules
 *
 * The obvious version of this script looks for operations we never declared,
 * because Payload fills those with `defaultAccess`, which is `Boolean(user)` —
 * true for an API key. That version cannot work. `addDefaultsToCollectionConfig`
 * (payload/dist/collections/config/defaults.js:57) writes create, delete, read,
 * unlock and update onto every collection before anything can inspect it, so by
 * the time the config is importable, a rule we wrote and a rule Payload invented
 * are indistinguishable by name. Measured: on the unpatched config every one of
 * the fourteen collections reports all five keys present.
 *
 * So the question this asks is not "did someone declare a rule" but "what does
 * the rule actually do when a key calls it", which is the question that matters
 * and the one that keeps being answered wrongly.
 *
 * ## Why a table of expectations does not rot
 *
 * Anything absent from EXPECTED must deny. A new collection — the next plugin
 * someone adds — starts out failing this check and stays failing until a person
 * writes down what it is allowed to do. That is the property worth having: the
 * hole this script exists to catch arrived exactly that way, as four collections
 * that appeared with a plugin and were never given rules.
 */
import config from '@payload-config'

/** `true` = unrestricted, `filtered` = a Where narrows it, `false` = refused. */
type Verdict = 'full' | 'filtered' | 'denied'

type Persona = {
  /** How it reads in failure output. */
  label: string
  user: Record<string, unknown>
  /** collection -> operation -> what it may do. Absent means it must be denied. */
  expected: Record<string, Partial<Record<string, Verdict>>>
}

/**
 * Payload's own bookkeeping collections. Skipped because their rules ship with
 * Payload and we cannot change them, so failing on one would be noise nobody can
 * act on.
 */
const INTERNAL = /^payload-/

const PERSONAS: Persona[] = [
  {
    label: 'API key (apiClients)',
    user: { collection: 'apiClients', id: 'probe-key' },
    expected: {
      // The blog is the whole point of the key — see src/access/contentWriter.ts.
      posts: { create: 'full', read: 'full', update: 'full', delete: 'full' },
      media: { create: 'full', read: 'full', update: 'full', delete: 'full' },
      categories: { create: 'full', read: 'full', update: 'full', delete: 'full' },
      // Published-only, via a Where. A key has no business reading drafts.
      pages: { read: 'filtered' },
      // Public reads: these render on the site for anonymous visitors too.
      redirects: { read: 'full' },
      forms: { read: 'full' },
      search: { read: 'full' },
      // The public form posts here from the browser, unauthenticated.
      'form-submissions': { create: 'full' },
    },
  },
  {
    label: 'Editor (users, role=editor)',
    user: { collection: 'users', id: 'probe-editor', role: 'editor' },
    expected: {
      // create and delete are admin-only on purpose: a page is site structure,
      // and adding or removing one changes which URLs exist. Editors change the
      // words on a page that already exists. See src/collections/Pages/index.ts.
      pages: { read: 'full', update: 'full' },
      posts: { create: 'full', read: 'full', update: 'full', delete: 'full' },
      media: { create: 'full', read: 'full', update: 'full', delete: 'full' },
      categories: { create: 'full', read: 'full', update: 'full', delete: 'full' },
      search: { read: 'full' },
      redirects: { read: 'full' },
      // Editors run the site's forms; they are content. Submissions are not —
      // reading them is fine, deleting the record of a lead is not.
      forms: { create: 'full', read: 'full', update: 'full', delete: 'full' },
      'form-submissions': { create: 'full', read: 'full' },
      // Their own account only, hence a Where rather than true. `admin` is the
      // admin panel itself, deliberately open — it is where an editor works.
      users: { read: 'filtered', update: 'filtered', admin: 'full' },
      apiClients: {},
    },
  },
]

/** Every operation a collection can be asked to authorise. */
const operationsFor = (auth: boolean): string[] =>
  auth ? ['create', 'read', 'update', 'delete', 'unlock', 'admin'] : ['create', 'read', 'update', 'delete']

const classify = (result: unknown): Verdict => {
  if (result === true) return 'full'
  if (result === false || result === undefined || result === null) return 'denied'
  return 'filtered'
}

const resolved = await config
const failures: string[] = []
let checked = 0

for (const persona of PERSONAS) {
  for (const collection of resolved.collections ?? []) {
    if (INTERNAL.test(collection.slug)) continue

    const access = (collection.access ?? {}) as Record<string, unknown>

    for (const operation of operationsFor(Boolean(collection.auth))) {
      const rule = access[operation]
      if (typeof rule !== 'function') continue

      const req = { user: persona.user, payload: resolved, context: {} }
      const want = persona.expected[collection.slug]?.[operation] ?? 'denied'
      checked++

      let actual: Verdict
      try {
        actual = classify(await (rule as (a: unknown) => unknown)({ req }))
      } catch (error) {
        /**
         * Deliberately NOT treated as a denial.
         *
         * A throw most likely means this script called the rule with a `req`
         * shape it did not expect, so the answer is unknown — and "unknown"
         * recorded as "denied" is the one failure mode that would make this
         * whole script worthless: every rule it could not evaluate would read
         * as secure. Report it and fail instead, so an unevaluatable rule is
         * loud rather than reassuring.
         */
        failures.push(
          `${persona.label.padEnd(28)} ${collection.slug}.${operation.padEnd(8)} ` +
            `could not be evaluated: ${error instanceof Error ? error.message : String(error)}`,
        )
        continue
      }

      if (actual !== want) {
        failures.push(
          `${persona.label.padEnd(28)} ${collection.slug}.${operation.padEnd(8)} ` +
            `expected ${want}, got ${actual}`,
        )
      }
    }
  }
}

console.log(`Checked ${checked} access rules across ${PERSONAS.length} personas.\n`)

if (failures.length) {
  console.error(`${failures.length} rule(s) grant more than intended, or could not be checked:\n`)
  for (const failure of failures) console.error(`  ${failure}`)
  console.error('')
  process.exit(1)
}

console.log('No collection grants an API key or an editor more than intended.')
