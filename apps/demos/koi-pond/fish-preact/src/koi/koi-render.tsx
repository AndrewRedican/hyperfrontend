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
import type { KoiCardLink, KoiProfile, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { Koi } from '@hyperfrontend/demo-koi-lib/three'
import type { KoiState } from './koi-motion'
import type { GlRenderer, KoiStage } from './koi-stage'
import { createPondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { render } from 'preact'
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
  /**
   * Where the card's URL line currently sits, in pond space.
   *
   * This frame is pointer-transparent, so the link text drawn here can never be
   * clicked directly; the host lays a real anchor over the reported rectangle.
   *
   * @returns The rectangle, or `null` while the card is hidden.
   */
  cardLinkRect(): KoiCardLink | null
  /** Releases the GPU resources the koi holds and unmounts its tree. */
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
  // why: The stage, card, and URL anchor arrive when Preact commits the tree and leave when it unmounts, so everything below reaches them through these slots rather than closing over them.
  let stage: KoiStage | null = null
  let card: HTMLDivElement | null = null
  let cardUrl: HTMLAnchorElement | null = null
  // why: The card is positioned against the visible window, so the renderer keeps the last announced world the stage is already drawing.
  let current = pond

  const mount = (canvas: HTMLCanvasElement, cardNode: HTMLDivElement, linkNode: HTMLAnchorElement): (() => void) => {
    const built = createKoiStage(canvas, profile, pond, createGl)
    stage = built
    card = cardNode
    cardUrl = linkNode
    return () => {
      built.dispose()
      stage = null
      card = null
      cardUrl = null
    }
  }

  render(<KoiFish profile={profile} url={url} mount={mount} />, root)

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
      current = next
      stage?.setPond(next)
    },

    setHovered(hovered) {
      if (card !== null) {
        card.hidden = !hovered
      }
    },

    placeCard(state) {
      if (card !== null) {
        // why: A card that has not laid out yet still needs a footprint to clamp against, so nominal dimensions stand in until the browser has measured it.
        const size = { width: card.offsetWidth || 200, height: card.offsetHeight || 64 }
        card.style.transform = cardTransform(cardAnchor(state, current.view, size))
      }
    },

    cardLinkRect() {
      if (card === null || card.hidden || cardUrl === null) {
        return null
      }
      // why: The frame fills the visible window exactly, so client coordinates become pond coordinates by adding the window's origin back on.
      const rect = cardUrl.getBoundingClientRect()
      return { x: rect.left + current.view.x, y: rect.top + current.view.y, width: rect.width, height: rect.height }
    },

    dispose() {
      // why: Unmounting runs the koi effect's cleanup, so the GPU resources and the DOM nodes leave together.
      render(null, root)
    },
  }
}
