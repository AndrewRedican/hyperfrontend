/**
 * The one view of the pond every fish agrees to draw through.
 *
 * Eight applications each render one koi into their own transparent frame, and
 * the frames are composited into a single scene. That only reads as *one* pond
 * if every application builds the same camera, lights its koi the same way and
 * exposes the same tone curve — a koi that is warmer, larger or more oblique
 * than its neighbours breaks the illusion instantly.
 *
 * This module is the agreement, expressed as numbers. It is deliberately
 * renderer-free so the host — which draws no fish — can reason about the view
 * without ever importing a rendering engine. The camera *builder* that turns
 * these numbers into a projection lives in the `./three` entry.
 */

/** The numbers every fish derives its camera and renderer setup from. */
export interface PondViewSpec {
  /**
   * How far the camera leans off straight-down, in degrees, toward the bottom
   * of the screen.
   *
   * Straight down leaves the dorsal fin edge-on and the koi reading flat; a
   * few degrees lets the body's volume and the fins catch light while the
   * scene still reads as an overhead pond.
   */
  tiltDeg: number
  /** Vertical field of view in degrees; narrow reads as an overhead photograph. */
  fovDeg: number
  /** Tone-mapping exposure every fish renders with. */
  exposure: number
  /** The lighting preset name every fish passes to the adapter's light builder. */
  lighting: 'pond'
}

/** The framing the pond is drawn at, shared by every fish. */
export const POND_VIEW: PondViewSpec = { tiltDeg: 10, fovDeg: 26, exposure: 1.15, lighting: 'pond' }

/**
 * How many CSS pixels one world unit spans at the swim plane.
 *
 * The scale convention that keeps the independent renders coherent: one
 * world unit is one nominal fish length. A koi built at
 * `physical.length = lengthScale` therefore projects to the same on-screen
 * length the pond's 2D motion model reports on the wire.
 *
 * @param fishLength - The pond's nominal fish length in CSS pixels.
 * @returns CSS pixels per world unit.
 *
 * @example Converting a pond-space speed onto the swimming model
 * ```typescript
 * const bodyLengthsPerSecond = state.speed / pxPerUnit(pond.fishLength)
 * ```
 */
export function pxPerUnit(fishLength: number): number {
  return fishLength
}
