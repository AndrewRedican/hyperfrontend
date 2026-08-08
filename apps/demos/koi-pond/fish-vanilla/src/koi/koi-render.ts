/**
 * The vanilla renderer: one 3D koi, drawn through the shared pond view.
 *
 * Nothing is painted on `body` or on the app root — the hostee SDK resets both
 * to transparent, and anything painted there would blank the pond behind this
 * frame for every koi below it. The canvas clears to transparent; only the fish
 * itself has colour.
 *
 * This is the one browser-facing module in the app. The other six koi replace
 * exactly this file with their own framework's idiom, and share everything
 * else: the swimming brain stays authoritative for where the fish *is*, and
 * this module only makes the koi's body express it.
 */
import type { KoiProfile, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { Koi, PondView } from '@hyperfrontend/demo-koi-lib/three'
import type { WebGLRenderer } from 'three'
import type { KoiState } from './koi-motion'
import { POND_VIEW, koiSeed, pxPerUnit, swimDepth, wrapAngle } from '@hyperfrontend/demo-koi-lib'
import { createKoi, createLighting, createPondRenderer, createPondView, sizePondRenderer } from '@hyperfrontend/demo-koi-lib/three'
import { Scene } from 'three'

/** How the 2D build bands centre on the sculpted 3D koi's own proportions. */
const BUILD_CENTRE = { girthRatio: 0.115, tailSpan: 0.26, finSpan: 0.18 }

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
 * Builds the koi's canvas and scene inside a root element.
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
  const { palette, build, traits } = profile

  const canvas = document.createElement('canvas')
  canvas.className = 'koi-canvas'
  canvas.setAttribute('aria-hidden', 'true')

  const card = document.createElement('div')
  card.className = 'koi-card'
  card.hidden = true
  card.innerHTML = `<span class="koi-card-name"></span><span class="koi-card-url"></span>`
  const cardName = card.querySelector<HTMLElement>('.koi-card-name')
  const cardUrl = card.querySelector<HTMLElement>('.koi-card-url')
  if (cardName !== null) {
    cardName.textContent = profile.label
    cardName.style.color = palette.accent
  }
  if (cardUrl !== null) {
    cardUrl.textContent = url
  }

  root.append(canvas, card)

  const gl = createGl(canvas)
  const view: PondView = createPondView(pond)
  const scene = new Scene()
  scene.add(createLighting(POND_VIEW.lighting))

  const koi: Koi = createKoi({
    seed: koiSeed(profile.framework),
    physical: {
      length: build.lengthScale,
      // why: The 2D build bands predate the sculpted anatomy, so each ratio scales the 3D default rather than replacing it — the seeded variety survives without deforming the animal.
      width: build.girthRatio / BUILD_CENTRE.girthRatio,
      caudal: { span: 0.36 * (build.tailSpan / BUILD_CENTRE.tailSpan) },
      pectoral: { span: 0.165 * (build.finSpan / BUILD_CENTRE.finSpan) },
    },
    appearance: {
      base: palette.body,
      primary: palette.marking,
      secondary: palette.shade,
      accent: palette.accent,
    },
    trim: { responsiveness: traits.turnResponsiveness },
  })
  koi.mount(scene)

  let bodyPx = pxPerUnit(pond.fishLength) * build.lengthScale
  let lastHeading: number | null = null
  let lastSpeed = 0

  sizePondRenderer(gl, pond.width, pond.height)

  return {
    koi,
    draw(state, dt) {
      const seconds = dt > 0 ? dt : 1e-6
      // why: The swimming model thinks in this koi's own body lengths, while the brain and the wire think in pond pixels.
      const speed = state.speed / bodyPx
      // why: Pond headings grow clockwise on screen and the model's turn rate is positive toward the left flank, so the sign flips.
      const turnRate = lastHeading === null ? 0 : -wrapAngle(state.heading - lastHeading) / seconds
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
      sizePondRenderer(gl, next.width, next.height)
    },

    setHovered(hovered) {
      card.hidden = !hovered
    },

    placeCard(state) {
      const head = state.spine.joints[0]
      if (head === undefined) {
        return
      }
      card.style.transform = `translate(${(head.x + state.length * 0.12).toFixed(1)}px, ${(head.y - state.length * 0.38).toFixed(1)}px)`
    },

    dispose() {
      koi.dispose()
      gl.dispose()
      canvas.remove()
      card.remove()
    },
  }
}
