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
import type { KoiProfile, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { Koi } from '@hyperfrontend/demo-koi-lib/three'
import type { KoiState } from './koi-motion'
import type { GlRenderer, KoiStage } from './koi-stage'
import { createPondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
   * Positions the hover card beside the koi.
   *
   * @param state - What the koi is doing right now.
   */
  placeCard(state: KoiState): void
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
  // why: The stage and card arrive when React commits the tree and leave when it unmounts, so everything below reaches them through these slots rather than closing over them.
  let stage: KoiStage | null = null
  let card: HTMLDivElement | null = null
  let latestPond = pond

  const mount = (canvas: HTMLCanvasElement, cardNode: HTMLDivElement): (() => void) => {
    // why: A pond may have been announced while the tree was still mounting, so the stage is built from the latest one rather than the one this closure was born with.
    const built = createKoiStage(canvas, profile, latestPond, createGl)
    stage = built
    card = cardNode
    return () => {
      built.dispose()
      stage = null
      card = null
    }
  }

  const reactRoot = createRoot(root)
  reactRoot.render(
    <StrictMode>
      <KoiFish profile={profile} url={url} mount={mount} />
    </StrictMode>
  )

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
      if (card !== null) {
        card.hidden = !hovered
      }
    },

    placeCard(state) {
      if (card !== null) {
        card.style.transform = cardTransform(cardAnchor(state))
      }
    },

    dispose() {
      // why: Unmounting runs the koi effect's cleanup, so the GPU resources and the DOM nodes leave together.
      reactRoot.unmount()
    },
  }
}
