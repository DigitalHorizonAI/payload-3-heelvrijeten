/**
 * Site identity, in one place.
 *
 * The template hardcoded its name across page titles, Open Graph defaults and
 * the SEO plugin, so renaming meant editing every one of them. Anything that
 * needs the site's name or description reads it from here instead.
 */
export const SITE = {
  name: 'Heel Vrij Eten',
  description:
    'Expertartikelen over voeding, gezondheid, duurzaamheid en recepten. Onderbouwde kennis van onze Nederlandse voedingsdeskundigen en schrijvers.',
  /**
   * Path to the default social sharing image, relative to the public origin.
   * Resolves to the main site's own default OG image (its hero), so shared
   * blog links carry the same art as the rest of heelvrijeten.nl.
   */
  defaultOGImage: '/hero-editorial.webp',
} as const
