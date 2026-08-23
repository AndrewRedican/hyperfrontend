/**
 * The caret that leads a koi's turn.
 *
 * A koi settles on a heading well before its body has finished swinging onto
 * it, and the caret is where that decision is shown: a double chevron riding a
 * fixed orbit around the head, pointing outward along the heading the animal
 * has committed to. When the decision changes the caret slides around the orbit
 * to meet it, never in a jump and never faster than an eye can follow. It
 * arrives before the body does, because the slide outruns anything a koi's helm
 * can manage, so what a visitor catches is the turn being decided rather than
 * the turn being made.
 *
 * Speed carries the whole reading. A koi easing onto its next waypoint barely
 * moves its caret; one that has just decided to bolt throws the caret right
 * around its head. Nothing here is coloured, and nothing needs to be.
 */
import type { KoiOutline, Vec2 } from '@hyperfrontend/demo-koi-lib'
import { headingTo } from '@hyperfrontend/demo-koi-lib'

/** How far the caret orbits from the head centre, as a fraction of the reporting koi's length. */
export const CARET_ORBIT_BODIES = 0.42

/** How fast the caret may slide around its orbit, in radians per second. */
export const CARET_SLIDE_RAD_S = 2

/** How far a steering point has to sit from the head before its bearing says anything, in pond pixels. */
const CARET_BEARING_MIN_PX = 1

/** How far behind the outer chevron the inner one rides, in CSS pixels. */
const CARET_GAP_PX = 4.2

/** Half the height of one chevron, in CSS pixels. */
const CARET_ARM_PX = 4.4

/** How far a chevron's arms sweep back from its apex, in CSS pixels. */
const CARET_SWEEP_PX = 4

/** The alpha the caret carries: enough to lead the trace it sits over without competing with it. */
const CARET_ALPHA = 0.72

/** How wide every caret stroke is laid, in CSS pixels. */
const CARET_WIDTH_PX = 1.7

/**
 * The heading a koi has committed to.
 *
 * A decision reaches the overlay two ways. The steering point is the plain
 * statement of one: the waypoint being travelled to, or the far side of an
 * escape already chosen. A vertical manoeuvre names no point, and there the
 * commitment is the curvature the koi has wound into its own reported
 * advancement, which its far end carries. Either way the answer is a bearing
 * taken from the head, so it leads the body by exactly the turn still to come.
 *
 * @param outline - The koi's reported outline.
 * @param from - The head centre the bearing is taken from, in pond space.
 * @returns The committed heading in radians, falling back to the reported heading when the koi is steering by nothing.
 *
 * @example Sliding a caret onto what a koi has just decided
 * ```typescript
 * const angle = turnToward(riding, committedHeading(outline, head), CARET_SLIDE_RAD_S * dt)
 * ```
 */
export function committedHeading(outline: KoiOutline, from: Vec2): number {
  const path = outline.path
  const steer = outline.intent?.target ?? (path === undefined ? undefined : path[path.length - 1])
  // why: A koi sitting on its own steering point has arrived rather than decided, and a bearing taken across nothing would spin the caret onto an angle it never chose.
  if (steer === undefined || Math.hypot(steer.x - from.x, steer.y - from.y) < CARET_BEARING_MIN_PX) {
    return outline.heading
  }
  return headingTo(from, steer)
}

/**
 * Draws one koi's caret at the angle it has slid to.
 *
 * @param context - The overlay's drawing context.
 * @param ink - The overlay's single ink, as an `r, g, b` triple.
 * @param x - The head centre's x in overlay pixels.
 * @param y - The head centre's y in overlay pixels.
 * @param angle - Where the caret is riding, in radians.
 * @param bodyPx - The reporting koi's nose-to-tail length, which sizes the orbit.
 *
 * @example Marking a koi's decision on the overlay
 * ```typescript
 * paintCaret(context, '255, 255, 255', head.x - view.x, head.y - view.y, angle, spineLength(outline.spine))
 * ```
 */
export function paintCaret(context: CanvasRenderingContext2D, ink: string, x: number, y: number, angle: number, bodyPx: number): void {
  const alongX = Math.cos(angle)
  const alongY = Math.sin(angle)
  context.strokeStyle = `rgba(${ink}, ${CARET_ALPHA})`
  context.lineWidth = CARET_WIDTH_PX
  context.beginPath()
  // how: Two chevrons, the inner one riding a step behind the outer, so the mark reads as something the koi is following instead of a tick stamped on the water.
  for (let rank = 0; rank < 2; rank += 1) {
    const apex = bodyPx * CARET_ORBIT_BODIES - rank * CARET_GAP_PX
    const root = apex - CARET_SWEEP_PX
    context.moveTo(x + alongX * root - alongY * CARET_ARM_PX, y + alongY * root + alongX * CARET_ARM_PX)
    context.lineTo(x + alongX * apex, y + alongY * apex)
    context.lineTo(x + alongX * root + alongY * CARET_ARM_PX, y + alongY * root - alongX * CARET_ARM_PX)
  }
  context.stroke()
}
