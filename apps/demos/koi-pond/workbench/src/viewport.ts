/**
 * The workbench's viewport: one koi, one backdrop, two cameras.
 *
 * Deliberately plain. The koi is the thing being judged, so the scene around it
 * gives it nothing — a flat neutral field, a checker to read its silhouette
 * against, and no post-processing to hide behind. The renderer clears to
 * transparent and the backdrop is a separate plane, so switching the backdrop
 * off shows exactly what the pond will composite.
 *
 * Two cameras share one scene. The production camera is the pond's own framing,
 * near overhead; the orbit camera exists only here, and resetting to production
 * is one keystroke away at all times.
 */
import type { Koi, KoiDebugFlags, KoiLightingPreset } from '@hyperfrontend/demo-koi-lib/three'
import {
  ACESFilmicToneMapping,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  createKoi,
  createKoiDebugLayer,
  createLighting,
  createProductionCamera,
  placeCamera,
  PRODUCTION_FRAMING,
} from '@hyperfrontend/demo-koi-lib/three'

/** The backdrops the koi can be judged against. */
export type BackdropName = 'slate' | 'water' | 'checker' | 'transparent'

/** Every backdrop, in the order the panel offers them. */
export const BACKDROPS: readonly BackdropName[] = ['slate', 'water', 'checker', 'transparent']

/** Which camera is driving. */
export type CameraMode = 'production' | 'orbit'

/** What the workbench measures while it runs. */
export interface ViewportMetrics {
  /** Frames per second, averaged over the last half second. */
  fps: number
  /** Triangles the renderer drew last frame. */
  triangles: number
  /** Draw calls the renderer issued last frame. */
  drawCalls: number
  /** Vertices in the koi's buffers. */
  vertices: number
  /** Geometries and textures three.js is holding. */
  memory: string
  /** Milliseconds the koi's own update took. */
  updateMs: number
}

/** The running workbench viewport. */
export interface Viewport {
  /** The koi under inspection. */
  readonly koi: Koi
  /** What it is costing. */
  readonly metrics: ViewportMetrics
  /**
   * Switches between the pond's camera and the inspection camera.
   *
   * @param mode - Which camera should drive.
   */
  setCameraMode(mode: CameraMode): void
  /**
   * Reframes the production camera.
   *
   * @param tilt - How far off straight-down it leans, in degrees.
   * @param swing - How far around the koi that lean is taken, in degrees.
   * @param distance - Distance from the koi as a multiple of its length.
   */
  setFraming(tilt: number, swing: number, distance: number): void
  /** Returns the orbit camera to the production framing. */
  resetCamera(): void
  /**
   * Changes the backdrop the koi is judged against.
   *
   * @param backdrop - Which backdrop to show.
   */
  setBackdrop(backdrop: BackdropName): void
  /**
   * Changes the light the koi is judged under.
   *
   * @param preset - Which lighting to use.
   */
  setLighting(preset: KoiLightingPreset): void
  /**
   * Turns debug overlays on and off.
   *
   * @param flags - Which overlays should show.
   */
  setDebug(flags: Partial<KoiDebugFlags>): void
  /**
   * Freezes or resumes the animation.
   *
   * @param running - Whether time should advance.
   */
  setRunning(running: boolean): void
  /**
   * Poses the koi at an exact point in its tail beat.
   *
   * @param phase - Phase in radians.
   */
  scrubTo(phase: number): void
  /** Whether time is advancing. */
  readonly running: boolean
  /** Tears the viewport down. */
  dispose(): void
}

/** The colours each backdrop paints. */
const BACKDROP_COLOURS: Readonly<Record<BackdropName, string>> = {
  slate: '#2a2e33',
  water: '#1e3a42',
  checker: '#3a3f45',
  transparent: '#000000',
}

/**
 * Draws the transparency checker the koi is composited against.
 *
 * @returns A canvas texture source, tiled by the backdrop material.
 */
function checkerCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')
  if (context !== null) {
    context.fillStyle = '#3a3f45'
    context.fillRect(0, 0, 64, 64)
    context.fillStyle = '#2c3035'
    context.fillRect(0, 0, 32, 32)
    context.fillRect(32, 32, 32, 32)
  }
  return canvas
}

/**
 * Opens the workbench viewport in a container element.
 *
 * @param container - The element to fill.
 * @returns The running viewport, already animating.
 *
 * @example Booting the workbench
 * ```typescript
 * const viewport = createViewport(document.querySelector('#stage'))
 * viewport.setDebug({ spine: true })
 * ```
 */
export function createViewport(container: HTMLElement): Viewport {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearAlpha(0)
  // why: A koi's white ground blows out under a linear response; a filmic curve keeps the shoulder of the highlight and is what the pond will render with too.
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  container.append(renderer.domElement)

  const scene = new Scene()
  const koi = createKoi({ seed: 977 })
  koi.mount(scene)

  const debug = createKoiDebugLayer(koi)
  scene.add(debug.object)

  let lights = createLighting('development')
  scene.add(lights)

  const backdrop = new Mesh(
    new PlaneGeometry(40, 40),
    new MeshBasicMaterial({ color: new Color(BACKDROP_COLOURS.slate), toneMapped: false })
  )
  backdrop.rotation.x = -Math.PI / 2
  backdrop.position.y = -koi.config.physical.length * 0.9
  const backdropGroup = new Group()
  backdropGroup.add(backdrop)
  scene.add(backdropGroup)

  const production = createProductionCamera(1)
  const orbit = new PerspectiveCamera(35, 1, 0.02, 60)
  orbit.position.copy(production.position)
  const controls = new OrbitControls(orbit, renderer.domElement)
  controls.enableDamping = true
  controls.target.set(0, 0, 0)
  controls.enabled = false

  const framing = { ...PRODUCTION_FRAMING }
  const metrics: ViewportMetrics = { fps: 0, triangles: 0, drawCalls: 0, vertices: 0, memory: '', updateMs: 0 }
  let mode: CameraMode = 'production'
  let running = true
  let frames = 0
  let sampledAt = performance.now()
  let previous = performance.now()

  const resize = (): void => {
    const width = container.clientWidth
    const height = container.clientHeight
    renderer.setSize(width, height, false)
    for (const camera of [production, orbit]) {
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
    }
    placeCamera(production, framing, koi.config.physical.length)
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()

  renderer.setAnimationLoop((now) => {
    const delta = Math.min(0.1, (now - previous) / 1000)
    previous = now

    const started = performance.now()
    if (running) {
      koi.update(delta)
    }
    metrics.updateMs = performance.now() - started

    debug.update()
    controls.update()
    renderer.render(scene, mode === 'production' ? production : orbit)

    frames += 1
    if (now - sampledAt >= 500) {
      metrics.fps = Math.round((frames * 1000) / (now - sampledAt))
      frames = 0
      sampledAt = now
    }
    metrics.triangles = renderer.info.render.triangles
    metrics.drawCalls = renderer.info.render.calls
    metrics.vertices = koi.metrics.vertices
    metrics.memory = `${renderer.info.memory.geometries} geo · ${renderer.info.memory.textures} tex`
  })

  return {
    koi,
    metrics,
    get running() {
      return running
    },
    setCameraMode(next) {
      mode = next
      controls.enabled = next === 'orbit'
      if (next === 'orbit') {
        orbit.position.copy(production.position)
        orbit.up.set(0, 1, 0)
        controls.target.set(0, 0, 0)
        controls.update()
      }
    },
    setFraming(tilt, swing, distance) {
      framing.tilt = tilt
      framing.swing = swing
      framing.distance = distance
      placeCamera(production, framing, koi.config.physical.length)
    },
    resetCamera() {
      placeCamera(production, framing, koi.config.physical.length)
      orbit.position.copy(production.position)
      orbit.up.set(0, 1, 0)
      controls.target.set(0, 0, 0)
      controls.update()
    },
    setBackdrop(name) {
      backdropGroup.visible = name !== 'transparent'
      backdrop.material.color = new Color(BACKDROP_COLOURS[name])
      backdrop.material.map?.dispose()
      backdrop.material.map = null
      if (name === 'checker') {
        // why: A checker under a transparent clear is the only way to see whether the koi's own alpha is clean at its edges.
        const texture = new CanvasTexture(checkerCanvas())
        texture.wrapS = RepeatWrapping
        texture.wrapT = RepeatWrapping
        texture.repeat.set(20, 20)
        backdrop.material.color = new Color('#ffffff')
        backdrop.material.map = texture
      }
      backdrop.material.needsUpdate = true
    },
    setLighting(preset) {
      scene.remove(lights)
      lights = createLighting(preset)
      scene.add(lights)
      backdrop.material.color = new Color(preset === 'pond' ? BACKDROP_COLOURS.water : BACKDROP_COLOURS.slate)
    },
    setDebug(flags) {
      debug.setFlags(flags)
    },
    setRunning(next) {
      running = next
    },
    scrubTo(phase) {
      koi.setBeat(phase)
    },
    dispose() {
      observer.disconnect()
      renderer.setAnimationLoop(null)
      controls.dispose()
      debug.dispose()
      koi.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
