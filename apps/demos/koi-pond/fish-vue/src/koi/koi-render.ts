/**
 * The Vue renderer seam: one 3D koi component, driven through a plain handle.
 *
 * The runtime loop never learns that Vue exists. It calls `createKoiRenderer`
 * and drives the plain object it gets back; this module is where that object
 * comes from — it mounts the {@link KoiFish} component and returns the
 * imperative handle the component hands up from its own `onMounted`, which Vue
 * flushes synchronously inside `mount`. The runtime rebuilds through this
 * factory on every wake from sleep, so each call mounts a fresh Vue app and
 * `dispose` unmounts it whole.
 *
 * Nothing is painted on `body` or on the app root — the hostee SDK resets both
 * to transparent, and anything painted there would blank the pond behind this
 * frame for every koi below it. The canvas clears to transparent; only the fish
 * itself has colour.
 */
import type { KoiProfile, KoiRenderer, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { GlRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { createPondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { createApp } from 'vue'
import KoiFish from './KoiFish.vue'

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
    draw: scene.draw,
    setPond: scene.setPond,
    setHovered: scene.setHovered,
    setSelected: scene.setSelected,
    updateCard: scene.updateCard,
    placeCard: scene.placeCard,
    cardRects: scene.cardRects,
    dispose() {
      // why: Unmounting is the whole teardown — the component releases the GPU in its own unmounted hook and Vue removes the canvas and card with the tree.
      app.unmount()
    },
  }
}
