/**
 * The main site's navigation, mirrored so the two bars match.
 *
 * One file of plain data, mirroring the main site's Layout.tsx nav
 * (heelgezondeten repo). Re-syncing is a diff of this file.
 *
 * Links to the main site are ABSOLUTE. The blog is reachable both at
 * heelvrijeten.nl/blog (proxied) and at cms.heelvrijeten.nl directly,
 * and a root-relative "/over-ons" would 404 on the second one. Blog-internal
 * links stay relative so they work on either host.
 */
export type NavLink = {
  label: string
  href: string
  note?: string
}

/**
 * The public site origin. Not the CMS's own URL: the blog answers on both
 * heelvrijeten.nl/blog (proxied) and cms.heelvrijeten.nl, and only the
 * first one has a home page to link back to.
 */
export const SITE = 'https://heelvrijeten.nl'

export const LINKS = {
  alleProducten: { label: 'Alle Producten', href: `${SITE}/producten` },
  bestsellers: { label: 'Bestsellers', href: `${SITE}/producten?filter=bestseller` },
  schrijvers: { label: 'Schrijvers', href: `${SITE}/schrijvers` },
  onsVerhaal: { label: 'Ons Verhaal', href: `${SITE}/over-ons` },
  veelgesteldeVragen: { label: 'Veelgestelde Vragen', href: `${SITE}/veelgestelde-vragen` },
  contact: { label: 'Contact', href: `${SITE}/contact` },

  blog: { label: 'Blog', href: '/blog' },

  /**
   * Blog-only. The main site's bar has no search, so this is the one
   * intentional difference between the two navs.
   */
  search: { label: 'Artikelen zoeken', href: '/search' },
} satisfies Record<string, NavLink>

/**
 * The announcement bar above the header, mirroring the main site's. If the
 * offer changes there, re-sync this copy — it lives only here.
 */
export const ANNOUNCEMENT = {
  text: 'Gratis bezorging bij bestellingen boven €35 —',
  linkLabel: 'Bekijk het assortiment',
  href: `${SITE}/producten`,
}

/** The 3-column header: links left and right of the centered wordmark. */
export const NAV_LEFT: NavLink[] = [LINKS.alleProducten, LINKS.bestsellers]
export const NAV_RIGHT: NavLink[] = [LINKS.blog, LINKS.schrijvers, LINKS.onsVerhaal]

export const MOBILE_LINKS: NavLink[] = [
  LINKS.alleProducten,
  LINKS.bestsellers,
  LINKS.blog,
  LINKS.search,
  LINKS.schrijvers,
  LINKS.onsVerhaal,
]

/**
 * Footer columns, mirroring the main site's Layout.tsx footer. The main site
 * lists its product categories under Winkel & Info from its catalog data; the
 * blog links the entry points instead of duplicating the catalog.
 */
export const FOOTER_BLURB =
  'Onze medewerkers staan dagelijks klaar om al uw vragen te beantwoorden!'

export const FOOTER_EMAIL = 'info@heelvrijeten.nl'

export const BUSINESS_DETAILS = [
  'Heel Vrij Eten is onderdeel van Spring Digital Commerce',
  'Adres: 2810 North Church Street',
  'Wilmington, DE 19802 (geen bezoekadres)',
  'EIN: 35-2886201',
]

export const FOOTER_WINKEL: NavLink[] = [
  LINKS.alleProducten,
  { label: 'Blog & Recepten', href: '/blog' },
  { label: 'Alle Onderwerpen', href: `${SITE}/blog/onderwerpen` },
  { label: 'Over Ons', href: `${SITE}/over-ons` },
]

export const FOOTER_KLANTENSERVICE: NavLink[] = [
  LINKS.contact,
  LINKS.veelgesteldeVragen,
  { label: 'Verzenden & Retourneren', href: `${SITE}/verzenden-retourneren` },
  { label: 'Privacybeleid', href: `${SITE}/privacybeleid` },
  { label: 'Algemene Voorwaarden', href: `${SITE}/algemene-voorwaarden` },
]
