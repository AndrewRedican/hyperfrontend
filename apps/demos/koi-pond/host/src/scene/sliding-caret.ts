/**
 * The caret that leads a koi's turn.
 *
 * A koi settles on a heading well before its body has finished swinging onto
 * it, and the caret is where that decision is shown: a nested pair of chevrons
 * riding an orbit around the head, pointing outward along the heading the
 * animal has committed to. The koi reports that heading itself, so the mark is
 * the steering term its own integrator is being handed rather than a bearing
 * worked out about it; what a visitor watches is therefore the real gap between
 * where the koi is pointed and where it has decided to point, closing as the
 * manoeuvre runs and standing at nothing once it is done. When the koi commits
 * to something else the caret slides round to meet it, never in a jump and
 * never faster than an eye can follow, and it arrives before the body does
 * because the slide outruns anything a koi's helm can manage.
 *
 * Two things beyond its angle are readable in it, and neither is a colour. Its
 * weight is how hard the koi is committed: a fish drifting onto its next
 * waypoint carries a whisper of a mark, and one that has decided on a manoeuvre
 * carries a firm one. Its core is filled once that manoeuvre is an avoidance,
 * so a koi that has noticed something and broken for it reads apart at a glance
 * from a koi merely swimming somewhere.
 *
 * Everything about the mark is measured off the body that reported it: the
 * orbit stands clear of that koi's own head and beam, and the chevrons are
 * scaled to its length, so a small slender koi and a large heavy one wear the
 * same mark at their own sizes rather than the same number of pixels.
 */
import type { KoiIntent } from '@hyperfrontend/demo-koi-lib'

/** How far outside its own head a caret orbits, as a fraction of the reporting koi's length. */
export const CARET_ORBIT_BODIES = 0.08

/** How fast the caret may slide around its orbit, in radians per second. */
export const CARET_SLIDE_RAD_S = 2

/** Half the height of the outer chevron, as a fraction of the reporting koi's length. */
const CARET_ARM_BODIES = 0.028

/** The band that arm may be drawn in, in CSS pixels, so the smallest koi still carries a mark and the largest is not wearing a banner. */
const CARET_ARM_PX = { min: 3.2, max: 8.5 }

/** How far the outer chevron's arms sweep back from its apex, as a fraction of its arm. */
const CARET_SWEEP_RATIO = 0.9

/** How far behind the outer chevron's apex the inner one rides, as a fraction of that arm. */
const CARET_GAP_RATIO = 0.62

/** How much smaller the inner chevron is than the outer one, so it sits wholly inside it. */
const CARET_INNER_SCALE = 0.5

/** How wide every caret stroke is laid, as a fraction of the outer chevron's arm. */
const CARET_WIDTH_RATIO = 0.36

/** The band that stroke may be laid in, in CSS pixels. */
const CARET_WIDTH_PX = { min: 1.3, max: 2.6 }

/** The alpha a caret carries when the koi is merely drifting onto its course. */
const CARET_ALPHA_DRIFT = 0.3

/** The alpha a caret carries when the koi has committed its whole helm. */
const CARET_ALPHA_COMMITTED = 0.9

/** The turn gain at which a koi counts as having committed rather than drifted. */
// why: The ladder's own glide nudge is 0.12 and every decided manoeuvre asks 0.55 or more, so the reading has to run out well before the lightest of those and be full by it.
const CARET_COMMITMENT = { drift: 0.12, committed: 0.55 }

/** What a caret needs to know about the koi wearing it. */
export interface CaretMark {
  /** The head anchor's x in overlay pixels. */
  x: number
  /** The head anchor's y in overlay pixels. */
  y: number
  /** Where the caret is riding, in radians. */
  angle: number
  /** How far the koi's own head and beam reach from that anchor, in pixels. */
  standoff: number
  /** The reporting koi's nose-to-tail length in pixels. */
  body: number
  /** What the koi reported it is steering by. */
  intent: KoiIntent
}

/**
 * Clamps a value into a band.
 *
 * @param value - The value to clamp.
 * @param band - The band to clamp into.
 * @returns The clamped value.
 */
function within(value: number, band: { min: number; max: number }): number {
  return value < band.min ? band.min : value > band.max ? band.max : value
}

/**
 * How firmly a koi is committed to the heading it reported, 0 to 1.
 *
 * @param gain - The multiplier the koi is steering with.
 * @returns The commitment, 0 for a drift and 1 for a decided manoeuvre.
 *
 * @example Weighting a mark by what stands behind it
 * ```typescript
 * const alpha = 0.3 + commitment(intent.gain) * 0.6
 * ```
 */
export function commitment(gain: number): number {
  const { drift, committed } = CARET_COMMITMENT
  const along = (gain - drift) / (committed - drift)
  return along < 0 ? 0 : along > 1 ? 1 : along
}

/**
 * Draws one koi's caret at the angle it has slid to.
 *
 * @param context - The overlay's drawing context.
 * @param ink - The overlay's single ink, as an `r, g, b` triple.
 * @param mark - The caret to draw and the koi wearing it.
 *
 * @example Marking a koi's decision on the overlay
 * ```typescript
 * paintCaret(context, '255, 255, 255', { x, y, angle, standoff, body, intent })
 * ```
 */
export function paintCaret(context: CanvasRenderingContext2D, ink: string, mark: CaretMark): void {
  const { x, y, angle, body, intent } = mark
  const arm = within(body * CARET_ARM_BODIES, CARET_ARM_PX)
  const sweep = arm * CARET_SWEEP_RATIO
  const gap = arm * CARET_GAP_RATIO
  // why: The orbit is measured off the reporting koi's own head rather than set as one fraction of its length, so the mark rides the same hair's breadth clear of a slender koi and a heavy one instead of touching the second.
  const apex = mark.standoff + body * CARET_ORBIT_BODIES
  const alongX = Math.cos(angle)
  const alongY = Math.sin(angle)
  const firm = commitment(intent.gain)
  const alpha = CARET_ALPHA_DRIFT + (CARET_ALPHA_COMMITTED - CARET_ALPHA_DRIFT) * firm
  const paint = `rgba(${ink}, ${alpha})`

  /**
   * Traces one chevron: an apex on the orbit and two arms swept back from it.
   *
   * @param tip - How far along the caret's bearing the apex sits, in pixels.
   * @param half - Half the chevron's height, in pixels.
   * @param back - How far its arms sweep behind the apex, in pixels.
   */
  const chevron = (tip: number, half: number, back: number): void => {
    const root = tip - back
    context.moveTo(x + alongX * root - alongY * half, y + alongY * root + alongX * half)
    context.lineTo(x + alongX * tip, y + alongY * tip)
    context.lineTo(x + alongX * root + alongY * half, y + alongY * root - alongX * half)
  }

  context.strokeStyle = paint
  context.lineWidth = within(arm * CARET_WIDTH_RATIO, CARET_WIDTH_PX)
  context.beginPath()
  chevron(apex, arm, sweep)
  // why: The inner chevron is a scaled copy set back inside the outer one's arms, so the pair reads as one drawn mark rather than as a repeated glyph.
  chevron(apex - gap, arm * CARET_INNER_SCALE, sweep * CARET_INNER_SCALE)
  context.stroke()

  if (intent.kind === 'travel') {
    return
  }
  // how: A koi that has committed to an avoidance fills the core of its mark, and a filled shape survives eight fish overlapping on a phone in a way a change of alpha alone would not.
  context.beginPath()
  chevron(apex - gap, arm * CARET_INNER_SCALE, sweep * CARET_INNER_SCALE)
  context.closePath()
  context.fillStyle = paint
  context.fill()
}
