/**
 * The pond camera, and the renderer settings that go with it.
 *
 * Seven fish each render into their own full-viewport frame; this module is
 * what makes those seven renders composite as one scene. Every fish builds the
 * same camera from the same pond announcement, so a koi handed from one frame
 * to the next would not move, resize or change hue.
 *
 * The mapping between pond space and the world is exact by construction:
 * {@link PondView.worldFromPond} casts a ray through the requested pixel onto
 * the swim plane, so a koi anchored there projects back to that pixel — the
 * outline a fish reports on the wire and the pixels it paints agree, whatever
 * the camera's tilt does to the rest of the body.
 */
import type { Object3D } from 'three'
import type { Vec2 } from '../model/types.js'
import { ACESFilmicToneMapping, PerspectiveCamera, Vector3, WebGLRenderer } from 'three'
import { POND_VIEW, pxPerUnit } from '../model/pond-view.js'

/** The slice of a pond announcement the view is built from. */
export interface PondViewport {
  /** The window of pond space the presenting frame currently shows. */
  view: {
    /** Pond-space x of the window's left edge. */
    x: number
    /** Pond-space y of the window's top edge. */
    y: number
    /** Window width in CSS pixels. */
    width: number
    /** Window height in CSS pixels. */
    height: number
  }
  /** Nose-to-tail length of a koi at depth scale 1, in CSS pixels. */
  fishLength: number
}

/** The shared view of the pond one fish renders through. */
export interface PondView {
  /** The camera, already placed; re-placed whenever the pond changes. */
  readonly camera: PerspectiveCamera
  /**
   * Re-derives the camera from a new pond announcement.
   *
   * @param pond - The world as the host most recently announced it.
   */
  setPond(pond: PondViewport): void
  /**
   * The point on the swim plane that projects to a pond-space position.
   *
   * @param at - The pond-space position in CSS pixels.
   * @param out - The vector to write into; a shared scratch vector when omitted.
   * @returns The world point; `y` is always 0.
   */
  worldFromPond(at: Vec2, out?: Vector3): Vector3
  /**
   * Anchors an object at a pond-space position, facing a pond-space heading.
   *
   * @param object - The object to move; its scale is left alone.
   * @param at - Where its origin belongs, in CSS pixels.
   * @param heading - Pond-space heading in radians; 0 along +x, clockwise on screen.
   */
  place(object: Object3D, at: Vec2, heading: number): void
}

/**
 * Builds the shared pond view for one fish's frame.
 *
 * @param pond - The world as the host announced it, or as the fish measured standalone.
 * @returns The view, camera placed and ready to render through.
 *
 * @example Rendering one koi through the shared view
 * ```typescript
 * const view = createPondView(pond)
 * view.place(koi.object, state.position, state.heading)
 * renderer.render(scene, view.camera)
 * ```
 */
export function createPondView(pond: PondViewport): PondView {
  const camera = new PerspectiveCamera(POND_VIEW.fovDeg, 1, 0.1, 10)
  const scratch = new Vector3()
  const anchor = new Vector3()
  let viewport = pond

  const setPond = (next: PondViewport): void => {
    const unitsHigh = next.view.height / pxPerUnit(next.fishLength)
    const tilt = (POND_VIEW.tiltDeg * Math.PI) / 180
    // why: The distance that makes the frustum span exactly the window's worth of swim plane is what makes one world unit project to one fish length of pixels.
    const distance = unitsHigh / (2 * Math.tan(((POND_VIEW.fovDeg / 2) * Math.PI) / 180))
    camera.aspect = next.view.width / next.view.height
    camera.position.set(0, Math.cos(tilt) * distance, Math.sin(tilt) * distance)
    // why: Pond y grows down-screen and maps onto world +z, so the camera's up has to be -z for the pond's top edge to render at the top of the frame.
    camera.up.set(0, 0, -1)
    camera.lookAt(0, 0, 0)
    camera.near = distance * 0.1
    // magic: Four times the camera distance comfortably contains any point in the margin beyond every viewport edge.
    camera.far = distance * 4
    camera.updateProjectionMatrix()
    // why: This camera lives outside any scene, so nothing else ever refreshes the world matrices that unprojection reads.
    camera.updateMatrixWorld()
    viewport = next
  }

  setPond(pond)

  const worldFromPond = (at: Vec2, out: Vector3 = scratch): Vector3 => {
    // why: Pond space is anchored on the virtual pond, so the point is first taken relative to the visible window this camera actually frames.
    out.set((2 * (at.x - viewport.view.x)) / viewport.view.width - 1, 1 - (2 * (at.y - viewport.view.y)) / viewport.view.height, 0.5)
    out.unproject(camera)
    out.sub(camera.position)
    // why: A camera above the plane looking down always gives the ray a negative y, but a degenerate viewport should fail visibly at the origin rather than throw at infinity.
    const reach = out.y < -1e-6 ? -camera.position.y / out.y : 0
    return out.multiplyScalar(reach).add(camera.position).setY(0)
  }

  return {
    camera,
    setPond,
    worldFromPond,
    place(object, at, heading) {
      object.position.copy(worldFromPond(at, anchor))
      // why: The koi's nose points along its local +x, and a pond heading grows clockwise on screen while a three.js yaw grows counter-clockwise.
      object.rotation.y = -heading
    },
  }
}

/**
 * Builds a renderer configured the way every fish must render.
 *
 * The transparency, tone curve and exposure here are part of the shared visual
 * contract — a fish that rendered with a different curve would wear different
 * colours than the shoal it swims with.
 *
 * @param canvas - The canvas to render into.
 * @returns The renderer, transparent and tone-mapped for the pond.
 *
 * @example Creating and sizing a fish's renderer
 * ```typescript
 * const renderer = createPondRenderer(canvas)
 * sizePondRenderer(renderer, pond.view.width, pond.view.height)
 * ```
 */
export function createPondRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setClearAlpha(0)
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = POND_VIEW.exposure
  return renderer
}

/**
 * Sizes a fish's renderer to its frame.
 *
 * Structurally typed so an app can drive a stand-in renderer in specs that
 * run without a GPU.
 *
 * @param renderer - The renderer to size.
 * @param width - Frame width in CSS pixels.
 * @param height - Frame height in CSS pixels.
 */
export function sizePondRenderer(renderer: Pick<WebGLRenderer, 'setPixelRatio' | 'setSize'>, width: number, height: number): void {
  // magic: Two device pixels per CSS pixel is where extra resolution stops being visible on a moving fish and starts costing fill rate.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height, false)
}
