/**
 * The pond camera, and the renderer settings that go with it.
 *
 * Each fish renders into its own full-viewport frame; this module is
 * what makes those independent renders composite as one scene. Every fish builds the
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

/** The sub-rect of pond space a frame call narrows the camera onto. */
export interface PondFrameRect {
  /** Pond-space x of the rect's left edge. */
  x: number
  /** Pond-space y of the rect's top edge. */
  y: number
  /** Rect edge length in CSS pixels. */
  size: number
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
   * Narrows the camera onto a square sub-rect of the view.
   *
   * The projection stays the shared pond camera's — the sub-rect renders
   * exactly the pixels the full view would have put there — so a small canvas
   * covering just one koi composites seamlessly with every other frame.
   *
   * @param rect - The sub-rect, usually a koi's own frame box.
   */
  frame(rect: PondFrameRect): void
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
  // why: When the camera is narrowed onto a sub-rect, unprojection must read NDC against that rect — the offset projection maps the rect, not the view, onto clip space.
  let framed: { x: number; y: number; width: number; height: number } | null = null

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
    framed = null
    camera.clearViewOffset()
  }

  setPond(pond)

  const worldFromPond = (at: Vec2, out: Vector3 = scratch): Vector3 => {
    // why: Pond space is anchored on the virtual pond, so the point is first taken relative to the window the camera currently frames — the whole view, or a narrowed sub-rect.
    const rect = framed ?? viewport.view
    out.set((2 * (at.x - rect.x)) / rect.width - 1, 1 - (2 * (at.y - rect.y)) / rect.height, 0.5)
    out.unproject(camera)
    out.sub(camera.position)
    // why: A camera above the plane looking down always gives the ray a negative y, but a degenerate viewport should fail visibly at the origin rather than throw at infinity.
    const reach = out.y < -1e-6 ? -camera.position.y / out.y : 0
    return out.multiplyScalar(reach).add(camera.position).setY(0)
  }

  return {
    camera,
    setPond,
    frame(rect) {
      framed = { x: rect.x, y: rect.y, width: rect.size, height: rect.size }
      camera.setViewOffset(
        viewport.view.width,
        viewport.view.height,
        rect.x - viewport.view.x,
        rect.y - viewport.view.y,
        rect.size,
        rect.size
      )
    },
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
  // why: The scenes are one small fish each, so the integrated GPU is always enough — asking for the high-performance one would spin up discrete silicon once per fish for no visible gain.
  // why: Eight of these share one page, and multisampling multiplies every one of their framebuffers. On a display dense enough to hide the stair-steps on its own that is memory bought for nothing — and on a phone it is memory that gets a frame killed, which costs the visitor a whole koi rather than a soft edge.
  const renderer = new WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, alpha: true, powerPreference: 'low-power' })
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

/** Largest drawing-buffer edge a koi's canvas may allocate, in device pixels. */
const MAX_FRAME_BUFFER_PX = 1280

/**
 * Sizes a fish's renderer to its own square frame box.
 *
 * The buffer edge is capped so a cinema display's koi never allocates more
 * than a bounded framebuffer: past the cap the device-pixel ratio yields
 * instead, which on a fish this size is invisible.
 *
 * @param renderer - The renderer to size.
 * @param size - Frame box edge length in CSS pixels.
 */
export function fitPondRenderer(renderer: Pick<WebGLRenderer, 'setPixelRatio' | 'setSize'>, size: number): void {
  const ratio = Math.min(window.devicePixelRatio, 2, size > 0 ? MAX_FRAME_BUFFER_PX / size : 2)
  renderer.setPixelRatio(ratio)
  renderer.setSize(size, size, false)
}
