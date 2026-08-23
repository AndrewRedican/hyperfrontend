/**
 * The interaction overlay: what each koi perceives and what it has decided,
 * drawn over the water.
 *
 * Every outline already carries the fish's own account of itself: the region it
 * is watching for encounters, the heading it has committed to and how hard, the
 * decision family behind it, and the advancement it is about to swim. This
 * painter turns those reports into three marks around each head, and lays all
 * three in one ink at varying strength. Nothing on this canvas is colour-coded;
 * what a decision is reads from where the marks sit, how they are weighted and
 * how fast they move, which is the only reading that survives eight fish
 * overlapping on a phone. A held koi reports no intent and simply has nothing
 * drawn.
 *
 * The field is the koi's real perception window rather than a drawn
 * approximation of one: the reach and the clearance it reports are exactly the
 * pair its own narrow phase gates a crossing on, so a neighbour inside the mark
 * is a neighbour the animal is actually weighing. It hangs from the nose the
 * koi judges from and opens ahead of it, which is what keeps it off the body at
 * every build, and it runs out of ink at every boundary rather than ending at a
 * line, so what a visitor reads is attention radiating off the animal rather
 * than a lit wedge stuck to its snout and painted over its own back.
 *
 * The pearls are the one thing on this canvas that outlives the frame they were
 * drawn in: they are placed in the water, not recomputed against it, so the
 * painter carries a chain per koi and walks its ends. What a chain is worth is
 * the koi's own accuracy, and the walk is in `pearl-trace.ts`.
 *
 * The caret rides ahead of both, on an orbit sized from the reporting koi's own
 * body, and answers what neither of the others can: not where the koi is going,
 * but where it has decided to go. It carries the commitment behind that
 * decision in its weight, and closes on the nose as the animal swings onto it.
 * Its slide is in `sliding-caret.ts`.
 */
import type { KoiOutline, Vec2 } from '@hyperfrontend/demo-koi-lib'
import type { KoiInstanceId } from './instance-id'
import { turnToward } from '@hyperfrontend/demo-koi-lib'
import { PEARL_MAX, PEARL_SPACING_BODIES, advanceTrace, pearlAlpha } from './pearl-trace'
import { canvasPixelRatio } from './pixel-ratio'
import { CARET_SLIDE_RAD_S, paintCaret } from './sliding-caret'

/** The single ink every mark on the overlay is drawn in, as an `r, g, b` triple. */
const OVERLAY_INK = '255, 255, 255'

/** Half a pearl's width, in CSS pixels: the trace is a chain of 5 to 6 pixel beads whatever the koi is doing. */
const PEARL_RADIUS_PX = 2.8

/** Stands in for an absent chain or an absent path, so neither costs an allocation on the hot path. */
const NOTHING: readonly Vec2[] = []

/** How far behind the nose the caret's orbit is centred, as a fraction of the reported body length. */
export const HEAD_CENTRE_ALONG = 0.12

/** How far ahead of the nose a koi's field opens, as a fraction of the reported body length. */
// why: The koi judges every crossing from its nose, and its whole body lies behind that point, so a band that opens ahead of it cannot be laid over the animal at any size or build. The standoff is what keeps the ink off the snout itself, with room to spare for the body a frame draws sitting a little behind the body the wire reports.
export const FIELD_STANDOFF_BODIES = 0.12

/** Alpha one shell of the field lays down; the shells stack toward the middle of the band. */
const FIELD_SHELL_ALPHA = 0.052

/** How many nested shells the field's lateral falloff is laid in. */
const FIELD_SHELLS = 9

/**
 * How sharply the field's ink falls off toward its flanks.
 *
 * Above 1 the shells crowd the middle of the band, so what a visitor reads is a
 * beam down the koi's own course that thins away rather than a slab of even
 * light; the boundary stays where the koi's clearance actually is, because that
 * is the edge the arithmetic gates on.
 */
const FIELD_TAPER = 2.2

/** Where along the field the ink reaches full strength, as a share of the run left after the standoff. */
// why: The mark is brightest where it leaves the animal and lets go toward the horizon, which is what reads as perception radiating off the koi rather than as another shaft of the light already on the water.
const FIELD_RISE = 0.07

/**
 * The nose-to-tail length an outline reports.
 *
 * The wire carries a koi's body as spine samples with a half-width each and
 * never states a length, so the length is the run of the chain itself.
 *
 * @param spine - The reported spine samples, nose first.
 * @returns The chain's length in pond pixels; zero for a chain of one sample or none.
 *
 * @example Sizing a head against the body that reported it
 * ```typescript
 * const head = spineLength(outline.spine) * 0.12
 * ```
 */
export function spineLength(spine: readonly Vec2[]): number {
  let length = 0
  let previous: Vec2 | null = null
  for (const sample of spine) {
    if (previous !== null) {
      length += Math.hypot(sample.x - previous.x, sample.y - previous.y)
    }
    previous = sample
  }
  return length
}

/**
 * The point a given distance back along a reported spine.
 *
 * @param spine - The reported spine samples, nose first.
 * @param back - How far back to walk from the nose, in pond pixels.
 * @returns The point in pond space, or the tail when the walk runs off the end.
 */
function alongSpine(spine: readonly Vec2[], back: number): Vec2 | null {
  let walked = 0
  let previous = spine[0]
  if (previous === undefined) {
    return null
  }
  for (const sample of spine.slice(1)) {
    const span = Math.hypot(sample.x - previous.x, sample.y - previous.y)
    if (walked + span >= back) {
      // why: The remainder is taken along the segment the walk lands on rather than along the reported heading, so a bending body carries its own anchor round with it instead of leaving it hanging off the outside of the bend.
      const into = span === 0 ? 0 : (back - walked) / span
      return { x: previous.x + (sample.x - previous.x) * into, y: previous.y + (sample.y - previous.y) * into }
    }
    walked += span
    previous = sample
  }
  return { x: previous.x, y: previous.y }
}

/**
 * Where a koi's caret orbits: the middle of its head.
 *
 * The nose is the end of the body that swings widest through a turn, so a mark
 * orbiting it slides away from the animal exactly when a visitor is watching
 * the animal decide. Pulling the centre back along the spine keeps it inside
 * the silhouette at every pose, and walking the reported chain rather than
 * projecting along the heading is what keeps it there through a bend, whatever
 * the koi's build.
 *
 * @param outline - The koi's reported outline.
 * @returns The orbit's centre in pond space, or `null` when the outline reports no body.
 *
 * @example Centring the overlay's caret
 * ```typescript
 * const head = headCentre(outline)
 * ```
 */
export function headCentre(outline: KoiOutline): Vec2 | null {
  return alongSpine(outline.spine, spineLength(outline.spine) * HEAD_CENTRE_ALONG)
}

/**
 * The widest half-width a koi reports, in pond pixels.
 *
 * @param girth - The reported half-width at each spine sample.
 * @returns The beam; zero when nothing was reported.
 *
 * @example Standing a mark clear of the body that reported it
 * ```typescript
 * const clear = spineLength(outline.spine) * 0.12 + beamOf(outline.girth)
 * ```
 */
export function beamOf(girth: readonly number[]): number {
  let beam = 0
  for (const half of girth) {
    beam = half > beam ? half : beam
  }
  return beam
}

/**
 * How far a koi's marks stand off its own head, in pond pixels.
 *
 * Derived from the body the koi itself reported rather than from any constant,
 * so a slender koi's marks ride closer to it than a heavy one's and both read
 * the same at any size the pond is presented at.
 *
 * @param outline - The koi's reported outline.
 * @param body - The koi's nose-to-tail length in pond pixels.
 * @returns The standoff measured from the head anchor.
 */
function headStandoff(outline: KoiOutline, body: number): number {
  return body * HEAD_CENTRE_ALONG + beamOf(outline.girth)
}

/**
 * Fills one koi's perception field.
 *
 * The band drawn is the koi's own encounter window, hung from its nose because
 * that is the point its narrow phase judges every crossing from: a neighbour
 * whose closest approach lands inside the band is a neighbour the koi is
 * weighing, and one outside it is a neighbour that koi will not act on. What is
 * left out is the water behind that nose, which the same test also watches: it
 * is where the animal already is, and a mark laid over the fish reporting it
 * says nothing a visitor can use. Leaving it out is also what makes the mark
 * safe at every build, since a koi's whole body lies behind the point the band
 * opens from.
 *
 * The one thing it cannot show is depth. A neighbour two levels away is no
 * obstacle at all, so a koi drawn inside another's band may be passing clean
 * underneath it; what the band answers is where this koi is looking, not which
 * of the shoal it can see.
 *
 * Nothing about it ends at a line. The flanks are laid in nested shells that
 * step the ink down to nothing at the clearance edge, and one gradient along
 * the run raises it out of the standoff and lets it go at the horizon.
 *
 * @param context - The overlay's drawing context.
 * @param x - The reporting koi's nose x in overlay pixels.
 * @param y - The reporting koi's nose y in overlay pixels.
 * @param heading - The koi's heading in radians.
 * @param reach - How far ahead the koi is anticipating, in pixels.
 * @param clearance - How near a neighbour has to pass to matter, in pixels.
 * @param standoff - How far ahead of the nose the band opens, in pixels.
 */
function paintField(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  heading: number,
  reach: number,
  clearance: number,
  standoff: number
): void {
  if (reach <= standoff || clearance <= 0) {
    return
  }
  const alongX = Math.cos(heading)
  const alongY = Math.sin(heading)
  const sideX = -alongY
  const sideY = alongX
  const opens = standoff / reach
  const fade = context.createLinearGradient(x, y, x + alongX * reach, y + alongY * reach)
  fade.addColorStop(0, `rgba(${OVERLAY_INK}, 0)`)
  fade.addColorStop(opens, `rgba(${OVERLAY_INK}, 0)`)
  fade.addColorStop(opens + (1 - opens) * FIELD_RISE, `rgba(${OVERLAY_INK}, ${FIELD_SHELL_ALPHA})`)
  fade.addColorStop(1, `rgba(${OVERLAY_INK}, 0)`)
  context.fillStyle = fade
  for (let shell = 0; shell < FIELD_SHELLS; shell += 1) {
    // how: Each shell is the same band at a narrower clearance, so the ink a point ends up under is how many of them reach it, which steps from nothing at the clearance edge to full down the middle.
    const half = clearance * ((FIELD_SHELLS - shell) / FIELD_SHELLS) ** FIELD_TAPER
    const nearX = x + alongX * standoff
    const nearY = y + alongY * standoff
    const farX = x + alongX * reach
    const farY = y + alongY * reach
    context.beginPath()
    context.moveTo(nearX + sideX * half, nearY + sideY * half)
    context.lineTo(farX + sideX * half, farY + sideY * half)
    context.lineTo(farX - sideX * half, farY - sideY * half)
    context.lineTo(nearX - sideX * half, nearY - sideY * half)
    context.closePath()
    context.fill()
  }
}

/**
 * One koi's report, named by the instance that made it.
 *
 * The overlay carries a pearl chain per koi from frame to frame, and a
 * framework stops naming a fish the moment two koi of one framework swim at
 * once — so the report travels here under the host's own name for the animal.
 */
export interface KoiSighting {
  /** The instance whose channel the report arrived on. */
  id: KoiInstanceId
  /** What that koi reported, carried forward to now. */
  outline: KoiOutline
}

/**
 * Lays one koi's pearl chain down.
 *
 * @param context - The overlay's drawing context.
 * @param chain - The pearls to draw in pond space, nearest first.
 * @param nose - The koi's nose in pond space, which the fade is measured from.
 * @param view - The pond-space origin of the visible window.
 * @param reachPx - How far a full chain reaches, in pond pixels.
 */
function paintTrace(context: CanvasRenderingContext2D, chain: readonly Vec2[], nose: Vec2, view: Vec2, reachPx: number): void {
  for (const pearl of chain) {
    // how: The fade is taken from where the pearl is rather than from its place in the chain, so a pearl brightens as the fish closes on it instead of stepping up each time the one ahead of it is swallowed.
    context.fillStyle = `rgba(${OVERLAY_INK}, ${pearlAlpha(Math.hypot(pearl.x - nose.x, pearl.y - nose.y), reachPx)})`
    context.beginPath()
    context.arc(pearl.x - view.x, pearl.y - view.y, PEARL_RADIUS_PX, 0, Math.PI * 2)
    context.fill()
  }
}

/** What the overlay needs to paint one frame. */
export interface InteractionsFrame {
  /** Overlay width in CSS pixels. */
  width: number
  /** Overlay height in CSS pixels. */
  height: number
  /** Pond-space origin of the visible window, so pond-space traces land on the right frame pixels. */
  view: { x: number; y: number }
  /** Device pixel ratio to render at; a ratio past the canvas ceiling paints at the ceiling. */
  pixelRatio: number
  /** Seconds since the previous painted frame, which is what holds each caret to a slide. */
  dt: number
  /** The dead-reckoned reports to annotate; a koi with neither an intent nor a path draws nothing. */
  shoal: readonly KoiSighting[]
}

/** A painter bound to the interactions canvas. */
export interface InteractionsPainter {
  /**
   * Paints one frame of decision annotations.
   *
   * @param frame - Everything the overlay needs to draw.
   */
  paint(frame: InteractionsFrame): void
  /** Wipes the overlay; used when the visitor toggles it off. */
  clear(): void
}

/**
 * Binds a painter to the interactions canvas.
 *
 * @param canvas - The overlay canvas, sitting above the water.
 * @returns The painter.
 *
 * @example Drawing the overlay while it is enabled
 * ```typescript
 * const overlay = createInteractionsPainter(canvas)
 * overlay.paint({ width, height, view, pixelRatio, shoal })
 * ```
 */
export function createInteractionsPainter(canvas: HTMLCanvasElement): InteractionsPainter {
  let sizedTo = ''
  // why: A pearl is placed in the water rather than worked out afresh against each frame, so the chains outlive the frames that drew them and are carried here between them.
  const traces = new Map<KoiInstanceId, readonly Vec2[]>()
  // why: A caret is only a slide because it remembers where it was riding last frame; a caret worked out from the decision alone would snap onto every one of them.
  const carets = new Map<KoiInstanceId, number>()
  // why: Reused rather than rebuilt per frame, for the same reason the caller reuses the frame itself.
  const present = new Set<KoiInstanceId>()

  return {
    paint(frame) {
      const context = canvas.getContext('2d')
      if (context === null || frame.width === 0 || frame.height === 0) {
        return
      }
      const ratio = canvasPixelRatio(frame.pixelRatio)
      // why: The signature is taken from the capped ratio, so a device reporting more than the ceiling never reallocates the backing store over a difference the canvas does not paint.
      const signature = `${frame.width}x${frame.height}@${ratio}`
      if (signature !== sizedTo) {
        // why: Assigning width resets the whole canvas state, so it only happens when the size actually changed.
        canvas.width = Math.round(frame.width * ratio)
        canvas.height = Math.round(frame.height * ratio)
        canvas.style.width = `${frame.width}px`
        canvas.style.height = `${frame.height}px`
        sizedTo = signature
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, frame.width, frame.height)

      present.clear()
      for (const sighting of frame.shoal) {
        const outline = sighting.outline
        const nose = outline.spine[0]
        const head = headCentre(outline)
        if (nose === undefined || head === null) {
          continue
        }
        present.add(sighting.id)

        // why: The chain is walked before a pearl of it is drawn, so a pearl the fresh report contradicts never outlives the tick that heard the contradiction.
        const body = spineLength(outline.spine)
        const spacing = body * PEARL_SPACING_BODIES
        const chain = advanceTrace(traces.get(sighting.id) ?? NOTHING, nose, outline.heading, outline.path ?? NOTHING, spacing)
        traces.set(sighting.id, chain)
        paintTrace(context, chain, nose, frame.view, spacing * PEARL_MAX)

        const intent = outline.intent
        if (intent === undefined) {
          continue
        }
        // how: The field is the koi's own encounter window, hung where the koi judges from, so it stretches with speed and a bolting koi visibly weighs further ahead of itself.
        paintField(
          context,
          nose.x - frame.view.x,
          nose.y - frame.view.y,
          outline.heading,
          intent.reachPx,
          intent.clearancePx,
          body * FIELD_STANDOFF_BODIES
        )

        // why: A koi is first seen already committed to something, so its caret starts where the decision is instead of sliding in from an angle nothing ever chose.
        const riding = carets.get(sighting.id)
        const angle = riding === undefined ? intent.heading : turnToward(riding, intent.heading, CARET_SLIDE_RAD_S * frame.dt)
        carets.set(sighting.id, angle)
        paintCaret(context, OVERLAY_INK, {
          x: head.x - frame.view.x,
          y: head.y - frame.view.y,
          angle,
          standoff: headStandoff(outline, body),
          body,
          intent,
        })
      }

      // why: A koi that has left the pond takes its chain and its caret with it, and a shoal this size is swept for a fraction of what tracking departures would cost.
      for (const id of traces.keys()) {
        if (!present.has(id)) {
          traces.delete(id)
          carets.delete(id)
        }
      }
    },

    clear() {
      // why: The overlay comes back on against wherever the shoal has got to by then, so neither a chain nor a caret survives being switched off.
      traces.clear()
      carets.clear()
      const context = canvas.getContext('2d')
      if (context !== null) {
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, canvas.width, canvas.height)
      }
    },
  }
}
