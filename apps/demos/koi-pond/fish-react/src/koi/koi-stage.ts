/**
 * The imperative side of the React koi: one 3D fish drawn through the shared
 * pond view, sixty times a second.
 *
 * React's reconciler is the wrong tool at that cadence, so nothing here is a
 * component. The koi component owns the canvas node and its lifecycle; this
 * module owns the three.js objects behind it and mutates them straight from
 * the frame loop. The swimming brain stays authoritative for where the fish
 * *is* — the stage only makes the koi's body express it.
 *
 * The canvas covers only the koi's own frame box, never the whole viewport:
 * the shared camera is narrowed onto that box each frame, so the small canvas
 * paints pixel-identically what a full-viewport render would have put there,
 * at a fraction of the fill and memory. A koi outside the visible window draws
 * nothing at all.
 */
import type { KoiFrameBox, KoiProfile, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { Koi, PondView } from '@hyperfrontend/demo-koi-lib/three'
import type { WebGLRenderer } from 'three'
import type { KoiState } from './koi-motion'
import { POND_VIEW, koiFrameBox, koiSeed, pxPerUnit, swimDepth, wrapAngle } from '@hyperfrontend/demo-koi-lib'
import { createKoi, createLighting, createPondView, fitPondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { Scene } from 'three'

/** The subset of a renderer this app drives, injectable so specs run without a GPU. */
export type GlRenderer = Pick<WebGLRenderer, 'render' | 'setSize' | 'setPixelRatio' | 'dispose'>

/** How far the frame box's edge may drift from the fitted buffer before a re-fit, as a fraction. */
const REFIT_DRIFT = 0.1

/** The three.js objects behind one mounted koi canvas. */
export interface KoiStage {
  /** The koi this stage drives, exposed for debug overlays and specs. */
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
   * Traces the koi's silhouette, or stops tracing it.
   *
   * @param strength - How firmly the silhouette reads, 0 (off) to 1.
   */
  setOutline(strength: number): void
  /** Releases the GPU resources the koi holds. */
  dispose(): void
}

/**
 * Builds the scene, camera, and koi behind an already-mounted canvas.
 *
 * @param canvas - The canvas React mounted for the koi.
 * @param profile - Everything about this koi that never changes.
 * @param pond - The world at build time; later announcements arrive via `setPond`.
 * @param createGl - The GL factory, replaceable so specs can run headless.
 * @returns The stage.
 *
 * @example Drawing a koi each frame
 * ```typescript
 * const stage = createKoiStage(canvas, profile, pond, createPondRenderer)
 * stage.draw(motion.state, dt)
 * ```
 */
export function createKoiStage(
  canvas: HTMLCanvasElement,
  profile: KoiProfile,
  pond: PondEnvironment,
  createGl: (canvas: HTMLCanvasElement) => GlRenderer
): KoiStage {
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
        // why: The speed memory must track through skipped frames too, or re-entering the view lands the whole offscreen speed change as a single-frame acceleration spike that convulses the body.
        lastSpeed = state.speed / bodyPx
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

    setOutline(strength) {
      koi.setOutline(strength)
    },

    dispose() {
      koi.dispose()
      gl.dispose()
    },
  }
}
