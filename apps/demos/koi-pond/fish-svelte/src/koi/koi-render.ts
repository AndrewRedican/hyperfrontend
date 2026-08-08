/**
 * The Svelte renderer: one 3D koi, drawn through the shared pond view.
 *
 * The stage component owns everything declarative — the canvas, the card and
 * its text — and exports imperative handles for everything per-frame. This
 * module folds those handles into the renderer shape the runtime drives, so
 * the loop never learns that Svelte exists.
 *
 * This is the one browser-facing seam in the app. The other six koi replace
 * exactly this layer with their own framework's idiom, and share everything
 * else: the swimming brain stays authoritative for where the fish *is*, and
 * the renderer only makes the koi's body express it.
 */
import type { KoiProfile, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { Koi } from '@hyperfrontend/demo-koi-lib/three'
import type { WebGLRenderer } from 'three'
import type { KoiState } from './koi-motion'
import { createPondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { flushSync, mount, unmount } from 'svelte'
import KoiStage from './KoiStage.svelte'

/** The subset of a renderer this app drives, injectable so specs run without a GPU. */
export type GlRenderer = Pick<WebGLRenderer, 'render' | 'setSize' | 'setPixelRatio' | 'dispose'>

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
  /** Releases the GPU resources the koi holds. */
  dispose(): void
}

/**
 * Mounts the koi's stage inside a root element and hands back its renderer.
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
  const stage = mount(KoiStage, { target: root, props: { profile, url, pond, createGl } })
  // why: Effects do not run during `mount`, and the stage builds its scene in one — flushing here is what returns a renderer that can draw immediately.
  flushSync()

  return {
    get koi() {
      return stage.koiHandle()
    },
    draw: stage.draw,
    setPond: stage.setPond,
    setHovered: stage.setHovered,
    placeCard: stage.placeCard,
    dispose() {
      void unmount(stage)
    },
  }
}
