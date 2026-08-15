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
import type { KoiCardDetails, KoiCardPanel, KoiProfile, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
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
   * Marks whether the host's pointer is over this koi.
   *
   * Hover only says "this is selectable": the silhouette reads softly and
   * nothing else changes — the identity card belongs to selection.
   *
   * @param hovered - Whether the pointer is over this koi.
   */
  setHovered(hovered: boolean): void
  /**
   * Marks whether a visitor is holding this koi.
   *
   * Holding traces the full silhouette and keeps the identity card open until
   * release, whatever the pointer does meanwhile.
   *
   * @param selected - Whether the koi is held.
   */
  setSelected(selected: boolean): void
  /**
   * Rewrites the card's live inspector rows.
   *
   * @param details - The koi's live facts.
   */
  updateCard(details: KoiCardDetails): void
  /**
   * Positions the identity card beside the koi, clamped into the visible window.
   *
   * @param state - What the koi is doing right now.
   */
  placeCard(state: KoiState): void
  /**
   * Where the card and its two links currently sit, in pond space.
   *
   * This frame is pointer-transparent, so nothing drawn here can be clicked
   * directly; the host floats real anchors over the reported rectangles and an
   * inert shield over the frame.
   *
   * @returns The card's geometry, or `null` while the card is hidden.
   */
  cardRects(): KoiCardPanel | null
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
