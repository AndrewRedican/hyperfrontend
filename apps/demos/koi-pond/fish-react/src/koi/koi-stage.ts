/**
 * The imperative side of the React koi: one 3D fish drawn through the shared
 * pond view, sixty times a second.
 *
 * React's reconciler is the wrong tool at that cadence, so nothing here is a
 * component. The koi component owns the canvas node and its lifecycle; this
 * module owns the three.js objects behind it and mutates them straight from
 * the frame loop. The swimming brain stays authoritative for where the fish
 * *is* — the stage only makes the koi's body express it.
 */
import type { KoiProfile, KoiTune, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { Koi, PondView } from '@hyperfrontend/demo-koi-lib/three'
import type { WebGLRenderer } from 'three'
import type { KoiState } from './koi-motion'
import { POND_VIEW, koiSeed, pxPerUnit, swimDepth, wrapAngle } from '@hyperfrontend/demo-koi-lib'
import { createKoi, createLighting, createPondView, sizePondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { Scene } from 'three'

/** The subset of a renderer this app drives, injectable so specs run without a GPU. */
export type GlRenderer = Pick<WebGLRenderer, 'render' | 'setSize' | 'setPixelRatio' | 'dispose'>

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
   * Takes the visitor's playground settings onto the body and the swim.
   *
   * @param tune - The scales to apply over this koi's own build and trim.
   */
  applyTune(tune: KoiTune): void
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

  sizePondRenderer(gl, pond.view.width, pond.view.height)

  return {
    koi,
    draw(state, dt) {
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
      view.place(koi.object, state.position, state.heading)
      gl.render(scene, view.camera)
    },

    setPond(next) {
      bodyPx = pxPerUnit(next.fishLength) * build.lengthScale
      view.setPond(next)
      sizePondRenderer(gl, next.view.width, next.view.height)
    },

    applyTune(tune) {
      // why: The scales ride on this koi's own derived numbers rather than replacing them, so the playground moves the whole shoal while each fish keeps its identity.
      koi.setTrim({
        amplitude: trim.amplitude * (tune.amplitudeScale ?? 1),
        frequency: trim.frequency * (tune.frequencyScale ?? 1),
        waveReach: tune.waveReach ?? trim.waveReach,
      })
      koi.setPhysical({
        width: (phenotype.width ?? 1) * (tune.widthScale ?? 1),
        height: (phenotype.height ?? 1) * (tune.heightScale ?? 1),
      })
    },

    dispose() {
      koi.dispose()
      gl.dispose()
    },
  }
}
