/**
 * The seam between this app's frame loop and its Preact tree.
 *
 * The loop never touches the DOM and never learns that Preact is here: it
 * drives the {@link KoiRenderer} this module hands back, and the mounted koi
 * decides what that means on screen. Mounting is the only render this module
 * asks for — Preact commits the tree and flushes its layout effect before
 * `render` returns, so the stage is already live when the renderer is handed
 * back. The stage and card still travel through slots rather than closures,
 * because unmounting on dispose is what empties them again.
 */
import type { KoiCardLink, KoiProfile, KoiRenderer, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { GlRenderer, KoiStage } from '@hyperfrontend/demo-koi-lib/three'
import type { KoiCardHandles } from './KoiFish'
import { cardAnchor, cardTransform, describeKoiCard } from '@hyperfrontend/demo-koi-lib'
import { createKoiStage, createPondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { render } from 'preact'
import { KoiFish } from './KoiFish'

/** How firmly the silhouette reads when the pointer is merely over the koi. */
const HOVER_OUTLINE = 0.35

/** How firmly the silhouette reads while a visitor holds the koi. */
const HELD_OUTLINE = 1

/**
 * Mounts the koi's canvas and scene into a root element.
 *
 * @param root - The app root the koi is drawn into.
 * @param profile - Everything about this koi that never changes.
 * @param url - The URL of the app rendering it, shown on the card.
 * @param pond - The world at build time; later announcements arrive via `setPond`.
 * @param createGl - The GL factory, replaceable so specs can run headless.
 * @returns The renderer.
 *
 * @example Drawing a koi each frame
 * ```typescript
 * const renderer = createKoiRenderer(root, profile, window.location.href, pond)
 * renderer.draw(motion.state, dt)
 * ```
 */
export function createKoiRenderer(
  root: HTMLElement,
  profile: KoiProfile,
  url: string,
  pond: PondEnvironment,
  createGl: (canvas: HTMLCanvasElement) => GlRenderer = createPondRenderer
): KoiRenderer {
  // why: The stage and the card's nodes arrive when Preact commits the tree and leave when it unmounts, so everything below reaches them through these slots rather than closing over them.
  let stage: KoiStage | null = null
  let handles: KoiCardHandles | null = null
  // why: The card is positioned against the visible window, so the renderer keeps the last announced world the stage is already drawing.
  let current = pond
  let hovered = false
  let selected = false

  /** Traces the silhouette at whatever the pointer and the hold currently justify. */
  const applyOutline = (): void => {
    stage?.setOutline(selected ? HELD_OUTLINE : hovered ? HOVER_OUTLINE : 0)
  }

  /**
   * A card element's rectangle lifted into pond space.
   *
   * @param element - The element to measure.
   * @returns The pond-space rectangle.
   */
  const rectOf = (element: HTMLElement): KoiCardLink => {
    // why: The frame fills the visible window exactly, so client coordinates become pond coordinates by adding the window's origin back on.
    const rect = element.getBoundingClientRect()
    return { x: rect.left + current.view.x, y: rect.top + current.view.y, width: rect.width, height: rect.height }
  }

  const mount = (canvas: HTMLCanvasElement, cardHandles: KoiCardHandles): (() => void) => {
    const built = createKoiStage(canvas, profile, pond, createGl)
    stage = built
    handles = cardHandles
    return () => {
      built.dispose()
      stage = null
      handles = null
    }
  }

  render(<KoiFish profile={profile} url={url} mount={mount} />, root)

  return {
    draw(state, dt) {
      stage?.draw(state, dt)
    },

    setPond(next) {
      current = next
      stage?.setPond(next)
    },

    setHovered(next) {
      hovered = next
      applyOutline()
    },

    setSelected(next) {
      selected = next
      // why: The card belongs to the hold, not the pointer — it stays open however the pointer moves, because the visitor is about to interact with it.
      if (handles !== null) {
        handles.card.hidden = !next
      }
      applyOutline()
    },

    updateCard(details) {
      if (handles === null) {
        return
      }
      const rows = describeKoiCard(details)
      handles.state.textContent = rows.state
      handles.runtime.textContent = rows.runtime
      handles.memory.textContent = rows.memory
      handles.event.hidden = rows.event === null
      handles.event.textContent = rows.event ?? ''
    },

    placeCard(state) {
      if (handles !== null) {
        // why: A card that has not laid out yet still needs a footprint to clamp against, so nominal dimensions stand in until the browser has measured it.
        const size = { width: handles.card.offsetWidth || 200, height: handles.card.offsetHeight || 64 }
        handles.card.style.transform = cardTransform(cardAnchor(state, current, size))
      }
    },

    cardRects() {
      if (handles === null || handles.card.hidden) {
        return null
      }
      return { frame: rectOf(handles.card), app: rectOf(handles.app), site: rectOf(handles.site), source: rectOf(handles.source) }
    },

    dispose() {
      // why: Unmounting runs the koi effect's cleanup, so the GPU resources and the DOM nodes leave together.
      render(null, root)
    },
  }
}
