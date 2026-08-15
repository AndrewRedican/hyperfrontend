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
 * Hover visibility is the one thing routed through a signal, because it moves
 * at pointer cadence; the card's per-frame placement writes its transform
 * directly so sixty updates a second never enter the reactive graph.
 */
import type { KoiProfile, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { Koi } from '@hyperfrontend/demo-koi-lib/three'
import type { KoiState } from './koi-motion'
import type { GlRenderer, KoiStage } from './koi-stage'
import { createPondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { cardAnchor, cardTransform } from './card-anchor'
import { createKoiStage } from './koi-stage'
import { KoiFish } from './KoiFish'

/** A renderer bound to one koi. */
export interface KoiRenderer {
  /** The koi this renderer drives, exposed for debug overlays and specs. */
  readonly koi: Koi
  /**
   * Advances and redraws the koi from its current state.
   *
   * @param state - What the koi is doing right now.
   * @param dt - Seconds since the previous frame.
   */
  draw(state: KoiState, dt: number): void
  /**
   * Re-derives the camera and canvas from a new pond announcement.
   *
   * @param pond - The world as the host most recently announced it.
   */
  setPond(pond: PondEnvironment): void
  /**
   * Shows or hides the hover identity card.
   *
   * @param hovered - Whether the host's pointer is over this koi.
   */
  setHovered(hovered: boolean): void
  /**
   * Positions the hover card beside the koi, clamped into the visible window.
   *
   * @param state - What the koi is doing right now.
   */
  placeCard(state: KoiState): void
  /** Releases the GPU resources the koi holds and disposes its tree. */
  dispose(): void
}

/**
 * Mounts the koi's canvas and scene into a root element.
 *
 * @param root - The app root the koi is drawn into.
 * @param profile - Everything about this koi that never changes.
 * @param url - The URL of the app rendering it, revealed on hover.
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
  // why: The stage and card arrive when the koi's `onMount` runs and leave with its cleanup, so everything below reaches them through these slots rather than closing over them.
  let stage: KoiStage | null = null
  let card: HTMLDivElement | null = null
  let latestPond = pond
  const [isHovered, setIsHovered] = createSignal(false)

  const mount = (canvas: HTMLCanvasElement, cardNode: HTMLDivElement): (() => void) => {
    const built = createKoiStage(canvas, profile, latestPond, createGl)
    stage = built
    card = cardNode
    return () => {
      built.dispose()
      stage = null
      card = null
    }
  }

  const unmount = render(() => <KoiFish profile={profile} url={url} hovered={isHovered} mount={mount} />, root)

  return {
    get koi() {
      if (stage === null) {
        throw new Error('koi is not mounted yet')
      }
      return stage.koi
    },

    draw(state, dt) {
      stage?.draw(state, dt)
    },

    setPond(next) {
      latestPond = next
      stage?.setPond(next)
    },

    setHovered(hovered) {
      setIsHovered(hovered)
    },

    placeCard(state) {
      if (card !== null) {
        // why: A tapped fish near a window edge must still show its whole card — on touch there is no hover to chase it with.
        const size = { width: card.offsetWidth || 200, height: card.offsetHeight || 64 }
        card.style.transform = cardTransform(cardAnchor(state, latestPond, size))
      }
    },

    dispose() {
      // why: Disposing the tree runs the koi's `onCleanup`, so the GPU resources and the DOM nodes leave together.
      unmount()
    },
  }
}
