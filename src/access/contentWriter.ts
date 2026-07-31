import type { Access } from 'payload'

/**
 * An administrator, or a machine identity allowed to publish articles.
 *
 * Wired to `create`/`update` on posts and `create` on media, and nowhere else.
 * `delete` stays on `authenticated` on purpose: a leaked key should not be
 * able to remove published work, and an external tool that needs to correct an
 * article can update it in place.
 *
 * Adding a collection here widens what every API key can do, so it is the one
 * decision to make deliberately rather than by convenience.
 */
export const contentWriter: Access = ({ req: { user } }) => {
  return user?.collection === 'users' || user?.collection === 'apiClients'
}
