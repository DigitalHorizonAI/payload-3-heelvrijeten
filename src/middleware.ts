import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * This app is the CMS/editor only — heelvrijeten.nl is served by its own
 * Netlify front-end reading this CMS's API. No host of this app is a public
 * site, so every frontend route is noindexed unconditionally: the generated
 * Railway host serves a full copy of the site, and its robots Disallow only
 * blocks crawling, not indexing of linked URLs.
 */
export function middleware(_request: NextRequest): NextResponse {
  const response = NextResponse.next()
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return response
}

export const config = {
  // Frontend routes only; the admin UI ships its own noindex meta and the
  // API gains nothing from the header.
  matcher: ['/((?!api|admin|_next|media).*)'],
}
