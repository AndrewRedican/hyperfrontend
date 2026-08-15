/**
 * The host-drawn chrome for a held koi: the selection ring and the card link.
 *
 * A koi paints itself inside its own pointer-transparent frame, so nothing the
 * fish draws can mark it as selected or take a click. Both affordances
 * therefore live host-side: a soft ring appended INTO the fish's own layer, so
 * it stacks and occludes exactly as the fish does across depth changes, and one
 * invisible anchor floated over the URL text the fish's identity card draws —
 * the fish styles the link, the host makes it clickable.
 */
import type { KoiCardLink, KoiFramework, KoiOutline, PondEnvironment } from '@hyperfrontend/demo-koi-lib'

/** How much water the ring claims past the body's own bounds, in nominal fish lengths. */
const RING_PAD_FL = 0.1

/** How far the drawn body leads its reported spine along the heading, as a fraction of body length. */
// why: The mesh is anchored by its spine pivot at the reported nose, so the pixels a visitor sees sit ahead of the wire outline; the ring must sit on the pixels, not the report.
const PIXEL_LEAD_FL = 0.355

/** The host chrome around a held koi. */
export interface SelectionChrome {
  /**
   * Raises the ring for a koi inside its own layer.
   *
   * @param framework - Which koi was held.
   */
  hold(framework: KoiFramework): void
  /**
   * Removes a koi's ring.
   *
   * @param framework - Which koi was released.
   */
  release(framework: KoiFramework): void
  /**
   * Fits a koi's ring around its reported body.
   *
   * @param framework - Whose ring to move.
   * @param outline - The koi's current outline.
   * @param pond - The announced world, for the view origin and the pad scale.
   */
  track(framework: KoiFramework, outline: KoiOutline, pond: PondEnvironment): void
  /**
   * Floats the link anchor over a reported card rectangle, or hides it.
   *
   * @param rect - Where the card's URL line sits in pond space, or `null`.
   * @param url - The koi's app URL, or `null` when nothing is shown.
   * @param pond - The announced world, for the view origin.
   */
  placeLink(rect: KoiCardLink | null, url: string | null, pond: PondEnvironment): void
  /** Removes every ring and the anchor. */
  dispose(): void
}

/**
 * Creates the selection chrome.
 *
 * @param root - The pond root the link anchor floats in.
 * @param layers - The host-owned koi containers, keyed by framework slug.
 * @returns The chrome.
 *
 * @example Marking a held koi from the frame loop
 * ```typescript
 * chrome.hold(framework)
 * chrome.track(framework, outline, pond)
 * ```
 */
export function createSelectionChrome(root: HTMLElement, layers: ReadonlyMap<KoiFramework, HTMLElement>): SelectionChrome {
  const rings = new Map<KoiFramework, HTMLElement>()

  const link = document.createElement('a')
  link.className = 'koi-card-link'
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.setAttribute('aria-label', 'Open this fish app in a new tab')
  link.hidden = true
  root.append(link)

  return {
    hold(framework) {
      const layer = layers.get(framework)
      if (layer === undefined || rings.has(framework)) {
        return
      }
      const ring = document.createElement('div')
      ring.className = 'koi-select-ring'
      layer.append(ring)
      rings.set(framework, ring)
    },

    release(framework) {
      rings.get(framework)?.remove()
      rings.delete(framework)
    },

    track(framework, outline, pond) {
      const ring = rings.get(framework)
      if (ring === undefined) {
        return
      }
      let left = Number.POSITIVE_INFINITY
      let top = Number.POSITIVE_INFINITY
      let right = Number.NEGATIVE_INFINITY
      let bottom = Number.NEGATIVE_INFINITY
      outline.spine.forEach((point, index) => {
        const halfWidth = outline.girth[index] ?? 0
        left = Math.min(left, point.x - halfWidth)
        right = Math.max(right, point.x + halfWidth)
        top = Math.min(top, point.y - halfWidth)
        bottom = Math.max(bottom, point.y + halfWidth)
      })
      if (left > right) {
        ring.removeAttribute('data-shown')
        return
      }
      const nose = outline.spine[0]
      const tail = outline.spine.at(-1)
      const chord = nose === undefined || tail === undefined ? 0 : Math.hypot(tail.x - nose.x, tail.y - nose.y)
      const leadX = Math.cos(outline.heading) * chord * PIXEL_LEAD_FL
      const leadY = Math.sin(outline.heading) * chord * PIXEL_LEAD_FL
      const pad = pond.fishLength * RING_PAD_FL
      const width = right - left + pad * 2
      const height = bottom - top + pad * 2
      ring.style.width = `${width.toFixed(1)}px`
      ring.style.height = `${height.toFixed(1)}px`
      ring.style.transform = `translate3d(${(left + leadX - pad - pond.view.x).toFixed(1)}px, ${(top + leadY - pad - pond.view.y).toFixed(1)}px, 0)`
      ring.setAttribute('data-shown', '')
    },

    placeLink(rect, url, pond) {
      if (rect === null || url === null) {
        link.hidden = true
        return
      }
      link.href = url
      link.style.width = `${rect.width.toFixed(1)}px`
      link.style.height = `${rect.height.toFixed(1)}px`
      link.style.transform = `translate3d(${(rect.x - pond.view.x).toFixed(1)}px, ${(rect.y - pond.view.y).toFixed(1)}px, 0)`
      link.hidden = false
    },

    dispose() {
      for (const ring of rings.values()) {
        ring.remove()
      }
      rings.clear()
      link.remove()
    },
  }
}
