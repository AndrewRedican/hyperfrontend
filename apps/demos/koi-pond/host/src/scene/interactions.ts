/**
 * The interaction overlay: what each koi is deciding, drawn over the water.
 *
 * Every outline already carries the fish's reported intent: its decision
 * family, the point it is steering toward, and how far ahead it is
 * anticipating. This painter turns those reports into an awareness cone over
 * each head and a dashed trace to each destination, coloured by the decision:
 * red for collision avoidance, green for ordinary travel, yellow for a
 * decided pass above or underneath a neighbour. The traces redraw from the
 * dead-reckoned noses every frame, so they follow the fish as it makes its
 * progress. A held koi reports no intent and simply has nothing drawn.
 *
 * The cone hangs off the middle of the head rather than the nose, and runs out
 * of ink at every boundary rather than ending at a line, so what a visitor
 * reads is a field of attention carried by the animal instead of a lit wedge
 * stuck to its snout.
 *
 * The outline also carries the advancement the koi has committed to, and that
 * is drawn as a chain of pearls the fish visibly swims through. The chain is
 * the one thing on this canvas that outlives the frame it was drawn in: pearls
 * are placed in the water, not recomputed against it, so the painter carries a
 * chain per koi and walks its ends. What the chain is worth is the koi's own
 * accuracy, and the walk is in `pearl-trace.ts`.
 */
import type { KoiOutline, Vec2 } from '@hyperfrontend/demo-koi-lib'
import type { KoiInstanceId } from './instance-id'
import { PEARL_MAX, PEARL_SPACING_BODIES, advanceTrace, pearlAlpha } from './pearl-trace'
import { canvasPixelRatio } from './pixel-ratio'

/** The overlay colour of each decision family, as an `r, g, b` triple. */
const INTENT_COLORS = {
  travel: '74, 222, 128',
  avoid: '255, 95, 86',
  'depth-change': '250, 204, 21',
} as const

/** The single ink the cone and the pearl trace are drawn in, as an `r, g, b` triple. */
const OVERLAY_INK = '255, 255, 255'

/** Half a pearl's width, in CSS pixels: the trace is a chain of 5 to 6 pixel beads whatever the koi is doing. */
const PEARL_RADIUS_PX = 2.8

/** Stands in for an absent chain or an absent path, so neither costs an allocation on the hot path. */
const NOTHING: readonly Vec2[] = []

/** Half-angle of the sensing cone, in radians — presentational: the brain's perception is a time horizon, not a view angle. */
export const CONE_HALF_RAD = 0.5

/** How far behind the nose the cone is anchored, as a fraction of the reported body length. */
export const HEAD_CENTRE_ALONG = 0.12

/** Alpha the cone carries against the head, before the lateral falloff thins it. */
const CONE_INK_ALPHA = 0.2

/** How sharply the cone thins between the head and its horizon. */
const CONE_FADE_POWER = 1.25

/** How many radial stops describe that thinning. */
const CONE_FADE_STOPS = 6

/** How many wedges each flank of the cone is filled in. */
const CONE_FLANK_WEDGES = 16

/** Dash pattern of every anticipated-path trace, in CSS pixels. */
const TRACE_DASH: readonly number[] = [7, 7]

/** How far along its heading a vertical manoeuvre's stub projects, as a fraction of the reach. */
const DEPTH_STUB_REACH = 0.55

/** One wedge of the awareness cone, cut relative to the koi's heading. */
export interface ConeWedge {
  /** Where the wedge starts, in radians off the heading. */
  from: number
  /** Where the wedge ends, in radians off the heading. */
  to: number
  /** The share of the cone's ink this wedge carries: 1 down the middle, 0 at the lateral edge. */
  ink: number
}

/**
 * How far off the heading the lateral falloff has thinned to a share of the ink.
 *
 * Inverts the raised cosine the cone fades by, which reaches nothing with zero
 * slope and so runs the ink out at the lateral edge instead of stopping it
 * there.
 *
 * @param ink - The share of the ink to solve for, 1 down the middle and 0 at the edge.
 * @returns The angle as a share of the cone's half-angle, 0 down the middle and 1 at the edge.
 */
function coneAngleAtInk(ink: number): number {
  return Math.acos(Math.sqrt(ink)) / (Math.PI / 2)
}

/** The angles the cone's wedges are cut at, from one lateral edge to the other. */
const CONE_CUTS: readonly number[] = Array.from({ length: CONE_FLANK_WEDGES * 2 + 1 }, (_unused, index) => {
  const rank = index - CONE_FLANK_WEDGES
  return Math.sign(rank) * coneAngleAtInk(1 - Math.abs(rank) / CONE_FLANK_WEDGES) * CONE_HALF_RAD
})

/**
 * The wedges the cone is filled in, from one lateral edge to the other.
 *
 * The cone has to run out sideways as well as forward, and a canvas fill takes
 * one paint at a time, so the sideways falloff is cut into wedges that each
 * carry their own share of the ink. Cutting them by even steps of ink rather
 * than by even angles puts the narrow wedges where the falloff is steepest, so
 * no two neighbours can differ by more than a single step and none of the steps
 * survives being laid over moving water. That is the whole point: the cone ends
 * in nothing, never in a line.
 *
 * The wedges are fixed relative to the heading, so they are cut once and turned
 * with the fish.
 */
export const CONE_WEDGES: readonly ConeWedge[] = Array.from({ length: CONE_FLANK_WEDGES * 2 }, (_unused, index) => {
  // how: Every wedge takes the ink of its own middle, so the flank it sits on drops out of the arithmetic and both read the same.
  const rank = Math.abs(index - CONE_FLANK_WEDGES + 0.5) + 0.5
  return { from: CONE_CUTS[index] ?? 0, to: CONE_CUTS[index + 1] ?? 0, ink: 1 - (rank - 0.5) / CONE_FLANK_WEDGES }
})

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
 * Where a koi's awareness cone is anchored: the middle of its head.
 *
 * The nose is the end of the body that swings widest through a turn, so a cone
 * hung off it slides away from the animal exactly when a visitor is watching
 * the animal decide. Pulling the anchor back down the spine keeps it inside the
 * silhouette at every pose, and keeps the cone on the fish with it.
 *
 * @param outline - The koi's reported outline.
 * @returns The anchor in pond space, or `null` when the outline reports no body.
 *
 * @example Anchoring the overlay's cone
 * ```typescript
 * const anchor = headCentre(outline)
 * ```
 */
export function headCentre(outline: KoiOutline): Vec2 | null {
  const nose = outline.spine[0]
  if (nose === undefined) {
    return null
  }
  const back = spineLength(outline.spine) * HEAD_CENTRE_ALONG
  return { x: nose.x - Math.cos(outline.heading) * back, y: nose.y - Math.sin(outline.heading) * back }
}

/**
 * Fills one koi's awareness cone.
 *
 * @param context - The overlay's drawing context.
 * @param x - The anchor's x in overlay pixels.
 * @param y - The anchor's y in overlay pixels.
 * @param heading - The koi's heading in radians.
 * @param reach - How far ahead the koi is anticipating, in pixels.
 */
function paintCone(context: CanvasRenderingContext2D, x: number, y: number, heading: number, reach: number): void {
  // how: The radial run thins the cone toward its horizon; the wedges thin it toward its sides, and between them no boundary is left for an edge to sit on.
  const fade = context.createRadialGradient(x, y, 0, x, y, reach)
  for (let stop = 0; stop <= CONE_FADE_STOPS; stop += 1) {
    const along = stop / CONE_FADE_STOPS
    fade.addColorStop(along, `rgba(${OVERLAY_INK}, ${CONE_INK_ALPHA * (1 - along) ** CONE_FADE_POWER})`)
  }
  context.fillStyle = fade
  for (const wedge of CONE_WEDGES) {
    context.globalAlpha = wedge.ink
    context.beginPath()
    context.moveTo(x, y)
    context.arc(x, y, reach, heading + wedge.from, heading + wedge.to)
    context.closePath()
    context.fill()
  }
  context.globalAlpha = 1
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
        const spacing = spineLength(outline.spine) * PEARL_SPACING_BODIES
        const chain = advanceTrace(traces.get(sighting.id) ?? NOTHING, nose, outline.heading, outline.path ?? NOTHING, spacing)
        traces.set(sighting.id, chain)
        paintTrace(context, chain, nose, frame.view, spacing * PEARL_MAX)

        const intent = outline.intent
        if (intent === undefined) {
          continue
        }
        const color = INTENT_COLORS[intent.kind]
        const noseX = nose.x - frame.view.x
        const noseY = nose.y - frame.view.y

        // how: The cone is the fish's forward anticipation window — it stretches with speed, so a bolting koi visibly sees further ahead.
        paintCone(context, head.x - frame.view.x, head.y - frame.view.y, outline.heading, intent.reachPx)

        context.setLineDash(<number[]>TRACE_DASH)
        context.lineWidth = 1.6
        context.strokeStyle = `rgba(${color}, 0.85)`
        if (intent.target !== null) {
          const targetX = intent.target.x - frame.view.x
          const targetY = intent.target.y - frame.view.y
          context.beginPath()
          context.moveTo(noseX, noseY)
          context.lineTo(targetX, targetY)
          context.stroke()
          context.setLineDash([])
          context.beginPath()
          context.arc(targetX, targetY, 3.2, 0, Math.PI * 2)
          context.fillStyle = `rgba(${color}, 0.9)`
          context.fill()
        } else {
          // how: A depth pass is vertical, so its trace is a short stub along the heading capped with chevrons pointing the way the fish decided to pass.
          const stub = intent.reachPx * DEPTH_STUB_REACH
          const stubX = noseX + Math.cos(outline.heading) * stub
          const stubY = noseY + Math.sin(outline.heading) * stub
          context.beginPath()
          context.moveTo(noseX, noseY)
          context.lineTo(stubX, stubY)
          context.stroke()
          context.setLineDash([])
          const up = intent.direction !== 'below'
          const step = up ? -5 : 5
          context.beginPath()
          for (const rank of [0, 1]) {
            const baseY = stubY + step * rank
            context.moveTo(stubX - 4, baseY)
            context.lineTo(stubX, baseY + step)
            context.lineTo(stubX + 4, baseY)
          }
          context.strokeStyle = `rgba(${color}, 0.9)`
          context.stroke()
        }
        context.setLineDash([])
      }

      // why: A koi that has left the pond takes its chain with it, and a shoal this size is swept for a fraction of what tracking departures would cost.
      for (const id of traces.keys()) {
        if (!present.has(id)) {
          traces.delete(id)
        }
      }
    },

    clear() {
      // why: The overlay comes back on against wherever the shoal has got to by then, so no chain survives being switched off.
      traces.clear()
      const context = canvas.getContext('2d')
      if (context !== null) {
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, canvas.width, canvas.height)
      }
    },
  }
}
