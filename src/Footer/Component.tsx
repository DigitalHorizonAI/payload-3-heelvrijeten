import Link from 'next/link'
import React from 'react'

import { Logo } from '@/components/Logo/Logo'
import {
  BUSINESS_DETAILS,
  FOOTER_BLURB,
  FOOTER_EMAIL,
  FOOTER_KLANTENSERVICE,
  FOOTER_WINKEL,
  type NavLink,
} from '@/site'

/**
 * The main site's footer, ported from heelgezondeten's Layout.tsx. Like the
 * header, it is code-owned (src/site.ts) and deliberately NOT read from the
 * Payload `footer` global — editing navItems in the CMS has no effect.
 */

const FooterLink: React.FC<{ link: NavLink }> = ({ link }) => {
  const className = 'text-sm text-muted-foreground hover:text-foreground transition-colors'
  return link.href.startsWith('/') ? (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  ) : (
    <a href={link.href} className={className}>
      {link.label}
    </a>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="container py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          <div>
            <Link href="/" className="inline-block mb-5" aria-label="Heel Vrij Eten home">
              <Logo className="text-lg" />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-6">
              {FOOTER_BLURB}
            </p>
            <h4 className="nav-link text-foreground mb-2">E-mail</h4>
            <a
              href={`mailto:${FOOTER_EMAIL}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {FOOTER_EMAIL}
            </a>
          </div>

          <div>
            <h4 className="nav-link text-foreground mb-4">Bedrijfsgegevens</h4>
            <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
              {BUSINESS_DETAILS.map((line) => (
                <li key={line}>
                  {line.includes('Spring Digital Commerce') ? (
                    <>
                      Heel Vrij Eten is onderdeel van{' '}
                      <span className="text-foreground">Spring Digital Commerce</span>
                    </>
                  ) : (
                    line
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="nav-link text-foreground mb-4">Winkel &amp; Info</h4>
            <ul className="space-y-3">
              {FOOTER_WINKEL.map((link) => (
                <li key={link.href}>
                  <FooterLink link={link} />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="nav-link text-foreground mb-4">Klantenservice</h4>
            <ul className="space-y-3">
              {FOOTER_KLANTENSERVICE.map((link) => (
                <li key={link.href}>
                  <FooterLink link={link} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground tracking-wide">
            © {new Date().getFullYear()} Heel Vrij Eten. Alle rechten voorbehouden.
          </p>
          <p className="text-xs text-muted-foreground tracking-wide">
            100% biologisch gecertificeerd · Eerlijk geteeld · Duurzaam verpakt
          </p>
        </div>
      </div>
    </footer>
  )
}
