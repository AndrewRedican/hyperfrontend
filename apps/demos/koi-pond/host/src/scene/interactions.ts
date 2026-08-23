/**
 * The interaction overlay: what each koi is deciding, drawn over the water.
 *
 * Every outline already carries the fish's reported intent — its decision
 * family, the point it is steering toward, and how far ahead it is
 * anticipating. This painter turns those reports into a sensing cone at each
 * nose and a dashed trace to each destination, coloured by the decision:
 * red for collision avoidance, green for ordinary travel, yellow for a
 * decided pass above or underneath a neighbour. The traces redraw from the
 * dead-reckoned noses every frame, so they follow the fish as it makes its
 * progress. A held koi reports no intent and simply has nothing drawn.
 */
import type { KoiOutline } from '@hyperfrontend/demo-koi-lib'
import { canvasPixelRatio } from './pixel-ratio'

/** The overlay colour of each decision family, as an `r, g, b` triple. */
const INTENT_COLORS = {
  travel: '74, 222, 128',
  avoid: '255, 95, 86',
  'depth-change': '250, 204, 21',
} as const

/** Half-angle of the sensing cone, in radians — presentational: the brain's perception is a time horizon, not a view angle. */
const CONE_HALF_RAD = 0.5

/** Dash pattern of every anticipated-path trace, in CSS pixels. */
const TRACE_DASH: readonly number[] = [7, 7]

/** How far along its heading a vertical manoeuvre's stub projects, as a fraction of the reach. */
const DEPTH_STUB_REACH = 0.55

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
  /** The dead-reckoned outlines to annotate; entries without an intent draw nothing. */
  outlines: readonly KoiOutline[]
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
 * overlay.paint({ width, height, view, pixelRatio, outlines })
 * ```
 */
export function createInteractionsPainter(canvas: HTMLCanvasElement): InteractionsPainter {
  let sizedTo = ''

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

      for (const outline of frame.outlines) {
        const intent = outline.intent
        const nose = outline.spine[0]
        if (intent === undefined || nose === undefined) {
          continue
        }
        const color = INTENT_COLORS[intent.kind]
        const noseX = nose.x - frame.view.x
        const noseY = nose.y - frame.view.y

        // how: The cone is the fish's forward anticipation window — it stretches with speed, so a bolting koi visibly sees further ahead.
        context.beginPath()
        context.moveTo(noseX, noseY)
        context.arc(noseX, noseY, intent.reachPx, outline.heading - CONE_HALF_RAD, outline.heading + CONE_HALF_RAD)
        context.closePath()
        context.fillStyle = `rgba(${color}, 0.07)`
        context.fill()
        context.strokeStyle = `rgba(${color}, 0.28)`
        context.lineWidth = 1
        context.stroke()

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
    },

    clear() {
      const context = canvas.getContext('2d')
      if (context !== null) {
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, canvas.width, canvas.height)
      }
    },
  }
}
