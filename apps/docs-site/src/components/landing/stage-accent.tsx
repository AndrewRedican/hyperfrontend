'use client'

import { useDemoStage } from '@/components/demo-stage'
import { getDemoTheme } from '@/components/demos/demo-fallback-card'

/**
 * Publishes the staged demo's accent at the document root, as a light and a
 * dark colour, for every surface outside the hero that takes the stage's hue:
 * the navigation's tint, the rule under the header, the water below the fold.
 *
 * A style element rather than an effect so the hue is in the first painted
 * frame and leaves with the page; the stylesheet registers the property it
 * resolves these into and eases between one demo's colour and the next, so a
 * rotation recolours the chrome at the same unhurried pace as the lattice
 * behind the hero.
 * @returns The declaration, and nothing visible.
 */
export function StageAccent() {
  const { activeDemo } = useDemoStage()
  const { accent } = getDemoTheme(activeDemo?.slug ?? '')
  return <style>{`:root{--stage-accent-light:rgb(${accent.light});--stage-accent-dark:rgb(${accent.dark})}`}</style>
}
