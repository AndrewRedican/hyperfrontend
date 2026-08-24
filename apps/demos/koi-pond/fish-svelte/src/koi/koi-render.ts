/**
 * The Svelte renderer: one 3D koi, drawn through the shared stage.
 *
 * The stage component owns everything declarative — the canvas, the card and
 * its text — and exports imperative handles for everything per-frame. This
 * module folds those handles into the renderer shape the runtime drives, so
 * the loop never learns that Svelte exists.
 *
 * This is the one browser-facing seam in the app. The other seven koi replace
 * exactly this layer with their own framework's idiom, and share everything
 * else: the swimming brain stays authoritative for where the fish *is*, and
 * the renderer only makes the koi's body express it.
 */
import type { KoiProfile, KoiRenderer, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { GlRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { createPondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { flushSync, mount, unmount } from 'svelte'
import KoiStage from './KoiStage.svelte'

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
    draw: stage.draw,
    setPond: stage.setPond,
    setHovered: stage.setHovered,
    setSelected(selected) {
      stage.setSelected(selected)
      // why: The hold opens the card through a rune, and the caller measures and places the card right after — flushing lands the flip before it looks.
      flushSync()
    },
    updateCard(details) {
      stage.updateCard(details)
      // why: The inspector rows land through a rune on Svelte's own flush; forcing it keeps the card's text current the moment the facts change.
      flushSync()
    },
    placeCard: stage.placeCard,
    cardRects: stage.cardRects,
    dispose() {
      void unmount(stage)
    },
  }
}
