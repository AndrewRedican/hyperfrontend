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
 * Nothing is painted on `body` or on the host element — the hostee SDK resets
 * the page to transparent, and anything painted there would blank the pond
 * behind this frame for every koi below it. The canvas clears to transparent;
 * only the fish itself has colour.
 */
import type { KoiProfile, KoiTune, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { Koi, PondView } from '@hyperfrontend/demo-koi-lib/three'
import type { WebGLRenderer } from 'three'
import type { KoiState } from './koi-motion'
import { POND_VIEW, koiSeed, pxPerUnit, swimDepth, wrapAngle } from '@hyperfrontend/demo-koi-lib'
import { createKoi, createLighting, createPondRenderer, createPondView, sizePondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { Scene } from 'three'

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
      current = next
      view.setPond(next)
      sizePondRenderer(gl, next.view.width, next.view.height)
    },

    setHovered(hovered) {
      card.hidden = !hovered
    },

    placeCard(state) {
      const head = state.spine.joints[0]
      if (head === undefined) {
        return
      }
      // why: The card rides off the koi's shoulder rather than its nose, so it never covers the fish a visitor is pointing at.
      // why: The card lives in the frame's own CSS space while the spine is in pond space, so the visible window's origin comes off first.
      const x = head.x - current.view.x + state.length * 0.12
      const y = head.y - current.view.y - state.length * 0.38
      card.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
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
      // note: The canvas and card belong to the element's template, so only the GPU resources leave here.
      koi.dispose()
      gl.dispose()
    },
  }
}
