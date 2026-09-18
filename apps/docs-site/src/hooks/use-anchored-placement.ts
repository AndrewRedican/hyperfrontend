'use client'

import type { CSSProperties, RefObject } from 'react'
import { useLayoutEffect, useState } from 'react'
import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** Smallest gap, in pixels, kept between a floating panel and the viewport's edge. */
const VIEWPORT_MARGIN = 8

/** Gap, in pixels, between the anchor and the panel that opens from it. */
const PANEL_GAP = 8

/** Which edge of the anchor the panel prefers to line up with. */
export type AnchoredAlign = 'start' | 'end'

/** Which side of the anchor the panel opens on. */
export type AnchoredSide = 'below' | 'above'

/** Where an anchored panel ended up, and the styles that put it there. */
export interface AnchoredPlacement {
  /** Absolute offsets from the anchor's own box; empty until the panel has been measured */
  style: CSSProperties
  /** Whether the panel sits under the anchor or over it */
  side: AnchoredSide
}

/** Options for {@link useAnchoredPlacement}. */
export interface AnchoredPlacementOptions {
  /** The edge the panel lines up with when both fit; defaults to `end` */
  align?: AnchoredAlign
}

/**
 * Where a floating panel has room to open from the control that anchors it.
 *
 * A panel pinned to one edge of its trigger is fine wherever the trigger sits
 * at that edge of the screen and wrong everywhere else: the same "Share"
 * control renders at the right of a wide row and at the left of a wrapped
 * one, and a panel that always opens leftward leaves half of itself off a
 * phone. So nothing is pinned. Once the panel exists, its size and the
 * anchor's position are read and the panel is placed where it fits: lined up
 * with the preferred edge when that keeps it on screen, with the other edge
 * when that does, and otherwise slid along the anchor until it is inside the
 * viewport. It opens below unless there is no room below and more above.
 *
 * Measured in a layout effect, so the panel is placed before it is painted
 * and never flashes at a position it is about to leave. The panel is
 * absolutely positioned inside its anchor, so nothing else on the page
 * moves. Re-measured when the window resizes, since that is what changes
 * the answer while a panel is open.
 *
 * @param open - Whether the panel is currently rendered
 * @param anchorRef - The positioned box the panel is absolutely placed in, which is also the box it opens from
 * @param panelRef - The panel itself, once rendered
 * @param options - Placement preferences
 * @param options.align - The anchor edge the panel lines up with when both fit; `end` unless said otherwise
 * @returns The styles to put on the panel, and the side it opened on
 * @example Placing a menu under its trigger
 * ```tsx
 * const placement = useAnchoredPlacement(open, containerRef, panelRef)
 * return (
 *   <div ref={containerRef} className="relative inline-block">
 *     <button onClick={() => setOpen(true)}>Share</button>
 *     {open ? <ul ref={panelRef} className="absolute" style={placement.style}>…</ul> : null}
 *   </div>
 * )
 * ```
 */
export function useAnchoredPlacement(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  { align = 'end' }: AnchoredPlacementOptions = {}
): AnchoredPlacement {
  const [placement, setPlacement] = useState<AnchoredPlacement>({ style: {}, side: 'below' })

  useLayoutEffect(() => {
    if (!open) return

    const place = () => {
      const anchor = anchorRef.current
      const panel = panelRef.current
      if (!anchor || !panel) return
      const box = anchor.getBoundingClientRect()
      const width = panel.offsetWidth
      const height = panel.offsetHeight
      const viewportWidth = document.documentElement.clientWidth
      const viewportHeight = window.innerHeight

      const preferred = align === 'end' ? box.right - width : box.left
      const alternate = align === 'end' ? box.left : box.right - width
      const fits = (left: number) => left >= VIEWPORT_MARGIN && left + width <= viewportWidth - VIEWPORT_MARGIN
      // why: the preferred edge wins when it fits, the other edge when only it does, and a panel that fits at neither is slid to the nearest position that keeps the whole of it on screen
      const chosen = fits(preferred) ? preferred : fits(alternate) ? alternate : preferred
      const left = max(VIEWPORT_MARGIN, min(chosen, viewportWidth - VIEWPORT_MARGIN - width))

      const roomBelow = viewportHeight - box.bottom - PANEL_GAP
      const roomAbove = box.top - PANEL_GAP
      const side: AnchoredSide = roomBelow >= height || roomBelow >= roomAbove ? 'below' : 'above'

      setPlacement({
        style: { left: left - box.left, top: side === 'below' ? box.height + PANEL_GAP : -(height + PANEL_GAP) },
        side,
      })
    }

    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, align, anchorRef, panelRef])

  return placement
}
