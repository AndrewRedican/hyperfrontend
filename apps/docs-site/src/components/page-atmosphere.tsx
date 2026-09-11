'use client'

import type { CSSProperties } from 'react'
import { trackScrollProgress } from '@/lib/scroll-progress'
import { useEffect } from 'react'

/** Props for {@link PageAtmosphere}. */
export interface PageAtmosphereProps {
  /**
   * Hue, in degrees, the descent is tinted with on the way down. Defaults to
   * the site's own blue.
   */
  accent?: number
}

/**
 * The environment behind a documentation page.
 *
 * Three fixed layers pinned below the header and behind everything else: a
 * wash that deepens as the reader descends, a sparse grain that is almost
 * countable at the top, and a fine film that takes over from it further down.
 * Together they give a long document somewhere to be rather than a flat ground
 * to sit on, and the change is slow enough that a reader notices the depth
 * rather than the effect.
 *
 * It is fixed rather than painted behind the article because the atmosphere is
 * the page's environment, not the article's background. A layer measured
 * against the document column stops at the column's edges, and a reader sees a
 * tinted panel with untouched navigation either side of it. Pinned to the
 * viewport instead, it runs under the navigation, the document, the index and
 * the gutters as one continuous field, and every surface above it keeps
 * whatever translucency it already had.
 *
 * The header is the one thing it stays out of, so the site's own chrome is the
 * same colour on every page at every depth. The layers start at the header's
 * lower edge and fade in over the first few dozen pixels, so the boundary is a
 * transition rather than a line.
 *
 * How far down the reader is arrives as `--page-progress`, published by
 * {@link trackScrollProgress}. Nothing here animates and nothing here paints
 * while the page is still: the property changes, the compositor repaints two
 * gradients, and that is the whole of the running cost.
 * @param props - See {@link PageAtmosphereProps}.
 * @param props.accent - Hue the descent is tinted with
 * @returns The atmosphere's layers.
 * @example Tinting a package's page with the package's own hue
 * ```tsx
 * <PageAtmosphere accent={packageAccentHue('@hyperfrontend/nexus')} />
 * ```
 */
export function PageAtmosphere({ accent }: PageAtmosphereProps = {}) {
  useEffect(() => {
    // why: a field that answers the scroll is the one part of this a reader could have opted out of, and the stylesheet holds it at a settled depth when nothing publishes the fraction
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined
    }
    return trackScrollProgress(window)
  }, [])

  return (
    <div
      aria-hidden="true"
      className="page-atmosphere"
      style={accent === undefined ? undefined : ({ '--page-accent': accent } as CSSProperties)}
    >
      <div className="page-atmosphere__wash" />
      <div className="page-atmosphere__specks" />
      <div className="page-atmosphere__film" />
    </div>
  )
}
