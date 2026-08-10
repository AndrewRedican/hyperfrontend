/**
 * The Vue renderer seam: one 3D koi component, driven through a plain handle.
 *
 * The runtime loop never learns that Vue exists. It calls `createKoiRenderer`
 * and drives the plain object it gets back; this module is where that object
 * comes from — it mounts the {@link KoiFish} component and returns the
 * imperative handle the component hands up from its own `onMounted`, which Vue
 * flushes synchronously inside `mount`.
 *
 * Nothing is painted on `body` or on the app root — the hostee SDK resets both
 * to transparent, and anything painted there would blank the pond behind this
 * frame for every koi below it. The canvas clears to transparent; only the fish
 * itself has colour.
 */
import type { KoiProfile, KoiTune, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { Koi } from '@hyperfrontend/demo-koi-lib/three'
import type { WebGLRenderer } from 'three'
import type { KoiState } from './koi-motion'
import { createPondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { createApp } from 'vue'
import KoiFish from './KoiFish.vue'

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
  /**
   * Takes the visitor's playground settings onto the body and the swim.
   *
   * @param tune - The scales to apply over this koi's own build and trim.
   */
  applyTune(tune: KoiTune): void
  /** Releases the GPU resources the koi holds. */
  dispose(): void
}

/** The slice of the renderer the mounted component hands up; disposal stays with the Vue app that owns the component. */
export type KoiSceneHandle = Omit<KoiRenderer, 'dispose'>

/**
 * Mounts the koi component into a root element and returns its renderer.
 *
 * @param root - The app root the koi is drawn into.
 * @param profile - Everything about this koi that never changes.
 * @param url - The URL of the app rendering it, revealed on hover.
 * @param pond - The world at mount time; later announcements arrive via `setPond`.
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
  // why: An array, not a `let` — an assignment inside the callback would leave the variable narrowed to `null` for the read below.
  const ready: KoiSceneHandle[] = []
  const app = createApp(KoiFish, {
    profile,
    url,
    pond,
    createGl,
    onReady(handle: KoiSceneHandle) {
      ready.push(handle)
    },
  })
  app.mount(root)

  const scene = ready[0]
  // why: Vue flushes mounted hooks synchronously inside `mount`, so a missing handle here means the component never mounted at all.
  if (scene === undefined) {
    throw new Error('koi scene failed to mount')
  }

  return {
    koi: scene.koi,
    draw: scene.draw,
    setPond: scene.setPond,
    setHovered: scene.setHovered,
    placeCard: scene.placeCard,
    applyTune: scene.applyTune,
    dispose() {
      // why: Unmounting is the whole teardown — the component releases the GPU in its own unmounted hook and Vue removes the canvas and card with the tree.
      app.unmount()
    },
  }
}
