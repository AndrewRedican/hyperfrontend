/**
 * The seam between this app's frame loop and its React tree.
 *
 * The loop never touches the DOM and never learns that React is here: it
 * drives the {@link KoiRenderer} this module hands back, and the mounted koi
 * decides what that means on screen. Mounting is the only render this module
 * asks for, and it is deliberately not waited on — `createRoot().render()`
 * schedules the tree rather than building it, so the first frames may well be
 * drawn at a stage that does not exist yet. They are not lost: the stage is
 * built from the latest pond the moment React commits the canvas, and the very
 * next frame paints onto it.
 */
import type {
  KoiCardDetails,
  KoiCardLink,
  KoiCardPanel,
  KoiProfile,
  KoiRenderer,
  KoiState,
  PondEnvironment,
} from '@hyperfrontend/demo-koi-lib'
import type { GlRenderer, KoiStage } from '@hyperfrontend/demo-koi-lib/three'
import type { KoiCardHandles } from './KoiFish'
import { cardAnchor, cardTransform, describeKoiCard } from '@hyperfrontend/demo-koi-lib'
import { createKoiStage, createPondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
  // why: The stage and the card's nodes arrive when React commits the tree and leave when it unmounts, so everything below reaches them through these slots rather than closing over them.
  let stage: KoiStage | null = null
  let handles: KoiCardHandles | null = null
  let latestPond = pond
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
    return { x: rect.left + latestPond.view.x, y: rect.top + latestPond.view.y, width: rect.width, height: rect.height }
  }

  const mount = (canvas: HTMLCanvasElement, cardHandles: KoiCardHandles): (() => void) => {
    // why: A pond may have been announced while the tree was still mounting, so the stage is built from the latest one rather than the one this closure was born with.
    const built = createKoiStage(canvas, profile, latestPond, createGl)
    stage = built
    handles = cardHandles
    // why: A hover or hold may equally have arrived while the tree was still mounting, so the fresh nodes take the flags this renderer already carries.
    cardHandles.card.hidden = !selected
    applyOutline()
    return () => {
      built.dispose()
      stage = null
      handles = null
    }
  }

  const reactRoot = createRoot(root)
  reactRoot.render(
    <StrictMode>
      <KoiFish profile={profile} url={url} mount={mount} />
    </StrictMode>
  )

  return {
    draw(state: KoiState, dt: number) {
      stage?.draw(state, dt)
    },

    setPond(next) {
      latestPond = next
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

    updateCard(details: KoiCardDetails) {
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

    placeCard(state: KoiState) {
      if (handles !== null) {
        // why: A card that has not laid out yet still needs a footprint to clamp against, so nominal dimensions stand in until the browser has measured it.
        const size = { width: handles.card.offsetWidth || 200, height: handles.card.offsetHeight || 64 }
        handles.card.style.transform = cardTransform(cardAnchor(state, latestPond, size))
      }
    },

    cardRects(): KoiCardPanel | null {
      if (handles === null || handles.card.hidden) {
        return null
      }
      return { frame: rectOf(handles.card), app: rectOf(handles.app), site: rectOf(handles.site), source: rectOf(handles.source) }
    },

    dispose() {
      // why: Unmounting runs the koi effect's cleanup, so the GPU resources and the DOM nodes leave together.
      reactRoot.unmount()
    },
  }
}
