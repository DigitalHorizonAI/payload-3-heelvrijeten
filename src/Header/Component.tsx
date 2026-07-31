import React from 'react'

import { HeaderClient } from './Component.client'

/**
 * The navigation is code-owned, defined in src/site.ts, so that it stays
 * identical to heelvrijeten.nl's. It is deliberately NOT read from the
 * Payload `header` global any more — editing navItems in the CMS will have no
 * effect on what renders here.
 */
export function Header() {
  return <HeaderClient />
}
