// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'

import sharp from 'sharp' // sharp-import
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { ApiClients } from './collections/ApiClients'
import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { plugins } from './plugins'
import { articleBySlugEndpoint, articlesListEndpoint } from './endpoints/articles'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL, getPublicSiteURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below and the import `BeforeLogin` statement on line 15.
      beforeLogin: ['@/components/BeforeLogin'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
      // `next build` prerenders with one worker per CPU, each holding its own
      // pool. With hundreds of article pages, workers × the default pool size
      // exhausts Postgres's connection cap (53300 "too many clients") and the
      // build fails. 4 per pool keeps even a 17-worker build under the cap.
      max: 4,
      // All three added 11 Sep 2026 after a fourteen-day silent outage on a sibling
      // CMS, and rolled across the whole fleet because every one of them shared the
      // bare pool. Every pooled connection went stale; with no keepalive nothing
      // detected it and with no acquire timeout every DB-backed request queued until
      // Railway's 300 s gateway timeout. Meanwhile /api/access and the admin shell
      // kept answering in 0.3 s, so the service read healthy while the public site
      // served a fourteen-day-old cached page.
      //
      // keepAlive lets TCP surface a dead socket so the pool can discard it, but
      // it does nothing on its own: pg defaults keepAliveInitialDelayMillis to 0
      // (pg/lib/client.js:82) and libuv reads 0 as "enable SO_KEEPALIVE, leave
      // TCP_KEEPIDLE alone", so Linux's tcp_keepalive_time applies and the first
      // probe is 7200 s away. Setting it to 10 s moves that FIRST probe, and
      // only that: Node's setKeepAlive takes no interval or count, so how long
      // after the first unanswered probe the socket is declared dead comes from
      // the container's tcp_keepalive_intvl and tcp_keepalive_probes, which we
      // have not measured. Minutes rather than hours - do not quote a figure.
      //
      // connectionTimeoutMillis bounds the queue wait, not just the dial: when it
      // is unset pg-pool pushes a pending request with no timer at all
      // (pg-pool/index.js:206-207), which is why one wedged pool hangs every
      // later request forever. Neither option prevents the outage — together
      // they turn a silent hang into a fast, visible error.
      //
      // ⛔ Deliberately no statement_timeout: `payload migrate` runs through this
      // same pool during the build, and a long migration must not be aborted.
      // ⛔ And deliberately no query_timeout, which looks like the missing piece
      // and is not. It abandons the query client-side without destroying the
      // socket and without emitting 'error' on the client (client.js:636-660,
      // query.js:122-134), so pool._remove never runs and a mid-protocol
      // connection is returned to the pool while the server still runs the query.
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    },
  }),
  collections: [Pages, Posts, Media, Categories, Users, ApiClients],
  // Both the app's own host and the public site: the blog is served through
  // heelvrijeten.nl while this runs on cms.heelvrijeten.nl.
  cors: [...new Set([getServerSideURL(), getPublicSiteURL()])].filter(Boolean),
  globals: [Header, Footer],
  plugins: [
    ...plugins,
    // storage-adapter-placeholder
  ],
  endpoints: [
    {
      path: '/health',
      method: 'get',
      handler: async (req) => {
        return new Response('OK', { status: 200 });
      }
    },
    articlesListEndpoint,
    articleBySlugEndpoint,
  ],
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
