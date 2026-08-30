'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useDemoStage } from '@/components/demo-stage'
import { getDemoTheme } from '@/components/demos/demo-fallback-card'

/** Props for {@link LightWell} */
interface LightWellProps {
  /** The section that sits in the lit water */
  children: ReactNode
}

/**
 * Rewrite a canvas `r, g, b` triple as the space-separated form a CSS colour
 * function takes an alpha alongside.
 * @param rgb - Channel triple as the demo themes carry it, e.g. `'251, 191, 36'`
 * @returns The same channels as `'251 191 36'`, ready for `rgb(… / α)`
 */
function cssTriple(rgb: string): string {
  return rgb
    .split(',')
    .map((channel) => channel.trim())
    .join(' ')
}

/**
 * The band under the hero, lit from above by whatever demo is on stage.
 *
 * The hero is a bespoke surface and the documentation below it is not, so the
 * seam between them used to be a hairline rule with a flat grey section under
 * it. This carries the hero's identity a screen further down: a blue volume
 * with the staged demo's hue entering at the top as one broad bloom and a few
 * soft shafts, thinning to nothing well before the content ends. It is light
 * in water, not water: no simulation, no canvas, a handful of painted layers
 * moving on nothing but composited transforms and opacity.
 *
 * The staged demo's accent arrives as CSS custom properties, so a rotation
 * recolours the band by changing two strings on one element rather than
 * re-rendering the section beneath it, and the light and dark triples are both
 * published for the stylesheet to choose between under `.dark`.
 * @param props - Component props
 * @param props.children - The section that sits in the lit water
 * @returns The lit band wrapping its children
 */
export function LightWell({ children }: LightWellProps) {
  const { activeDemo } = useDemoStage()
  const { accent } = getDemoTheme(activeDemo?.slug ?? '')

  return (
    <div
      className="light-well"
      style={{ '--demo-accent-light': cssTriple(accent.light), '--demo-accent-dark': cssTriple(accent.dark) } as CSSProperties}
    >
      <div aria-hidden="true" className="light-well__bloom" />
      <div aria-hidden="true" className="light-well__rays">
        <div className="light-well__beams light-well__beams--near" />
        <div className="light-well__beams light-well__beams--far" />
      </div>
      <div className="relative">{children}</div>
    </div>
  )
}
