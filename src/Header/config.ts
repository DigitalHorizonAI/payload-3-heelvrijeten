import type { GlobalConfig } from 'payload'

import { authenticated } from '@/access/authenticated'
import { link } from '@/fields/link'
import { revalidateHeader } from './hooks/revalidateHeader'

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: () => true,
    // Without this, `update` falls back to Payload's default — any logged-in
    // principal, which includes an API key. A key exists to publish articles; it
    // has no business rewriting the site's navigation.
    update: authenticated,
  },
  fields: [
    {
      name: 'navItems',
      type: 'array',
      fields: [
        link({
          appearances: false,
        }),
      ],
      maxRows: 6,
    },
  ],
  hooks: {
    afterChange: [revalidateHeader],
  },
}
