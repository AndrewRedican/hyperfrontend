/**
 * The imperative side of the Lit koi: one 3D fish drawn through the shared
 * pond view, sixty times a second.
 *
 * Lit's reactive update is the wrong tool at that cadence, so nothing here
 * asks the element to re-render. `<koi-fish>` owns everything declarative —
 * the canvas, the card and its text exist because its template says so — and
 * this module owns the three.js objects behind them, mutating them straight
 * from the frame loop. The swimming brain stays authoritative for where the
 * fish *is*; the renderer only makes the koi's body express it.
 *
 * The canvas covers only the koi's own frame box, never the whole viewport:
 * the shared camera is narrowed onto that box each frame, so the small canvas
 * paints pixel-identically what a full-viewport render would have put there,
 * at a fraction of the fill and memory. A koi outside the visible window draws
 * nothing at all.
 *
 * Nothing is painted on `body` or on the host element — the hostee SDK resets
 * the page to transparent, and anything painted there would blank the pond
 * behind this frame for every koi below it. The canvas clears to transparent;
 * only the fish itself has colour.
 */
import type { KoiFrameBox, KoiProfile, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { Koi, PondView } from '@hyperfrontend/demo-koi-lib/three'
import type { WebGLRenderer } from 'three'
import type { KoiState } from './koi-motion'
import { POND_VIEW, koiFrameBox, koiSeed, pxPerUnit, swimDepth, wrapAngle } from '@hyperfrontend/demo-koi-lib'
import { createKoi, createLighting, createPondRenderer, createPondView, fitPondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { Scene } from 'three'

/** The subset of a renderer this app drives, injectable so specs run without a GPU. */
export type GlRenderer = Pick<WebGLRenderer, 'render' | 'setSize' | 'setPixelRatio' | 'dispose'>

/** How far the frame box's edge may drift from the fitted buffer before a re-fit, as a fraction. */
const REFIT_DRIFT = 0.1

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
  /** Releases the GPU resources the koi holds. */
  dispose(): void
}

/**
 * Builds the scene, camera, and koi behind an already-rendered canvas and card.
 *
 * @param canvas - The canvas the element's template rendered for the koi.
 * @param card - The hover identity card the element's template rendered.
 * @param profile - Everything about this koi that never changes.
 * @param pond - The world at build time; later announcements arrive via `setPond`.
 * @param createGl - The GL factory, replaceable so specs can run headless.
 * @returns The renderer.
 *
 * @example Drawing a koi each frame
 * ```typescript
 * const renderer = createKoiRenderer(canvas, card, profile, pond)
 * renderer.draw(motion.state, dt)
 * ```
 */
export function createKoiRenderer(
  canvas: HTMLCanvasElement,
  card: HTMLElement,
  profile: KoiProfile,
  pond: PondEnvironment,
  createGl: (canvas: HTMLCanvasElement) => GlRenderer = createPondRenderer
): KoiRenderer {
  const { palette, build, phenotype, trim } = profile

  const gl = createGl(canvas)
  const view: PondView = createPondView(pond)
  const scene = new Scene()
  scene.add(createLighting(POND_VIEW.lighting))

  const koi: Koi = createKoi({
    seed: koiSeed(profile.framework),
    // why: The phenotype is the profile's own many-levered build — width, belly, head, fins — so the seven read as related but individually recognisable animals rather than one mesh at seven scales.
    physical: phenotype,
    appearance: {
      pattern: palette.pattern,
      base: palette.body,
      primary: palette.marking,
      secondary: palette.shade,
      accent: palette.accent,
    },
    trim,
  })
  koi.mount(scene)

  let bodyPx = pxPerUnit(pond.fishLength) * build.lengthScale
  let lastHeading: number | null = null
  let lastSpeed = 0
  let current = pond
  let fittedSize = 0
  let shown = true
  const box: KoiFrameBox = { x: 0, y: 0, size: 0, visible: false }

  return {
    koi,
    draw(state, dt) {
      koiFrameBox(state.position, state.heading, state.length, current.view, box)
      // why: A koi outside the window pays nothing — no pose, no uniforms, no clear, no composite. The brain keeps swimming; only the pixels stop.
      if (!box.visible) {
        if (shown) {
          shown = false
          canvas.style.display = 'none'
        }
        lastHeading = state.heading
        return
      }
      if (!shown) {
        shown = true
        canvas.style.display = ''
      }
      if (Math.abs(box.size - fittedSize) > fittedSize * REFIT_DRIFT) {
        // why: The buffer re-fits only when the body's size genuinely changed — reallocating a drawing buffer every frame would cost more than the render itself.
        fittedSize = box.size
        fitPondRenderer(gl, box.size)
        canvas.style.width = `${box.size}px`
        canvas.style.height = `${box.size}px`
      }
      canvas.style.transform = `translate3d(${(box.x - current.view.x).toFixed(1)}px, ${(box.y - current.view.y).toFixed(1)}px, 0)`

      const seconds = dt > 0 ? dt : 1e-6
      // why: The swimming model thinks in this koi's own body lengths, while the brain and the wire think in pond pixels.
      const speed = state.speed / bodyPx
      // why: Both grow clockwise on screen — the model's positive turn bends toward the right flank exactly as a growing pond heading turns — so the heading's own rate feeds straight in and the head leads into the turn.
      const turnRate = lastHeading === null ? 0 : wrapAngle(state.heading - lastHeading) / seconds
      koi.setMotion({
        speed,
        turnRate,
        acceleration: (speed - lastSpeed) / seconds,
        escapeIntensity: state.phase === 'escape' ? 1 : 0,
        depth: swimDepth(state.depth),
      })
      lastHeading = state.heading
      lastSpeed = speed
      koi.update(dt)
      view.frame(box)
      view.place(koi.object, state.position, state.heading)
      gl.render(scene, view.camera)
    },

    setPond(next) {
      bodyPx = pxPerUnit(next.fishLength) * build.lengthScale
      current = next
      view.setPond(next)
      // why: A pond announcement moves the window, so the next draw must re-fit rather than trust a buffer sized against the old world.
      fittedSize = 0
    },

    setHovered(hovered) {
      card.hidden = !hovered
    },

    placeCard(state) {
      const head = state.spine.joints[0]
      if (head === undefined) {
        return
      }
      // why: The card lives in the frame's own CSS space while the spine is in pond space, so the visible window's origin comes off first.
      const x = head.x - current.view.x + state.length * 0.12
      const y = head.y - current.view.y - state.length * 0.38
      // why: A tapped fish near a window edge must still show its whole card — on touch there is no hover to chase it with.
      const width = card.offsetWidth || 200
      const height = card.offsetHeight || 64
      const clampedX = Math.min(Math.max(x, 8), Math.max(8, current.view.width - width - 8))
      const clampedY = Math.min(Math.max(y, 8), Math.max(8, current.view.height - height - 8))
      card.style.transform = `translate(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px)`
    },

    dispose() {
      // note: The canvas and card belong to the element's template, so only the GPU resources leave here.
      koi.dispose()
      gl.dispose()
    },
  }
}
