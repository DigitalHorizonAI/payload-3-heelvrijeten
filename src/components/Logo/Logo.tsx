import clsx from 'clsx'
import React from 'react'

interface Props {
  className?: string
}

/** The main site's text wordmark: display serif, title case, lightly spaced. */
export const Logo = ({ className }: Props) => {
  return (
    <span className={clsx('font-display text-xl tracking-[0.04em] text-foreground', className)}>
      Heel Vrij Eten
    </span>
  )
}
