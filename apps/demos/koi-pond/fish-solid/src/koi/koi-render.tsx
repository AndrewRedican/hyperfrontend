/**
 * The seam between this app's frame loop and its Solid tree.
 *
 * The loop never touches the DOM and never learns that Solid is here: it
 * drives the {@link KoiRenderer} this module hands back, and the mounted koi
 * decides what that means on screen. Solid renders synchronously, so the stage
 * behind the canvas is already live when this module returns — the slots below
 * exist for the other end of the koi's life, where disposal empties them and
 * every later call falls harmlessly through.
 *
 * Selection visibility and the card's inspector rows are the only things
 * routed through signals, because they change a handful of times a minute; the
 * card's per-frame placement writes its transform directly so sixty updates a
 * second never enter the reactive graph.
 */
import type {
  KoiCardDetails,
  KoiCardLink,
  KoiCardPanel,
  KoiCardText,
  KoiProfile,
  KoiRenderer,
  KoiState,
  PondEnvironment,
} from '@hyperfrontend/demo-koi-lib'
import type { GlRenderer, KoiStage } from '@hyperfrontend/demo-koi-lib/three'
import type { KoiCardHandles } from './KoiFish'
import { cardAnchor, cardTransform, describeKoiCard } from '@hyperfrontend/demo-koi-lib'
import { createKoiStage, createPondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
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
  // why: The stage and the card's nodes arrive when the koi's `onMount` runs and leave with its cleanup, so everything below reaches them through these slots rather than closing over them.
  let stage: KoiStage | null = null
  let handles: KoiCardHandles | null = null
  let latestPond = pond
  let hovered = false
  const [isSelected, setIsSelected] = createSignal(false)
  const [rows, setRows] = createSignal<KoiCardText | null>(null)

  /** Traces the silhouette at whatever the pointer and the hold currently justify. */
  const applyOutline = (): void => {
    stage?.setOutline(isSelected() ? HELD_OUTLINE : hovered ? HOVER_OUTLINE : 0)
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
    const built = createKoiStage(canvas, profile, latestPond, createGl)
    stage = built
    handles = cardHandles
    return () => {
      built.dispose()
      stage = null
      handles = null
    }
  }

  const unmount = render(() => <KoiFish profile={profile} url={url} selected={isSelected} rows={rows} mount={mount} />, root)

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
      // why: The card belongs to the hold, not the pointer — it stays open however the pointer moves, because the visitor is about to interact with it.
      setIsSelected(next)
      applyOutline()
    },

    updateCard(details: KoiCardDetails) {
      setRows(describeKoiCard(details))
    },

    placeCard(state: KoiState) {
      if (handles !== null) {
        // why: A tapped fish near a window edge must still show its whole card — on touch there is no hover to chase it with.
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
      // why: Disposing the tree runs the koi's `onCleanup`, so the GPU resources and the DOM nodes leave together.
      unmount()
    },
  }
}
