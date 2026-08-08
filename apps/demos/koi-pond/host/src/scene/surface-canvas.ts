/**
 * The surface water.
 *
 * This canvas sits above every koi layer and never carries a fish. It draws two
 * things: the caustic light sliding over the water, and the rings from anything
 * that broke it. Because it is topmost and `pointer-events: none`, it reads as
 * the visitor looking *through* water at the shoal underneath.
 */
import type { RippleField } from './ripples'
import { resolveRipple } from './ripples'

/** How fast the caustic light drifts across the pond, in cycles per second. */
const CAUSTIC_DRIFT_HZ = 0.035

/** How many caustic bands cross the pond. */
const CAUSTIC_BANDS = 3

/** How much reduced motion damps the caustic drift and ring brightness. */
const REDUCED_MOTION_DAMPING = 0.35

/** What the surface needs to paint one frame. */
export interface SurfaceFrame {
  /** Surface width in CSS pixels. */
  width: number
  /** Surface height in CSS pixels. */
  height: number
  /** Device pixel ratio to render at. */
  pixelRatio: number
  /** The pond's nominal fish length, which sets how far rings spread. */
  fishLength: number
  /** Milliseconds since the pond opened. */
  elapsedMs: number
  /** Whether the visitor asked for reduced motion. */
  reducedMotion: boolean
  /** The rings currently spreading. */
  field: RippleField
}

/** A painter bound to one surface canvas. */
export interface SurfacePainter {
  /**
   * Paints one frame of surface water.
   *
   * @param frame - Everything the surface needs to draw.
   */
  paint(frame: SurfaceFrame): void
}

/**
 * Binds a painter to the surface canvas.
 *
 * @param canvas - The surface canvas, sitting above every koi layer.
 * @returns The painter.
 *
 * @example Painting the water each frame
 * ```typescript
 * const surface = createSurfacePainter(canvas)
 * loop.start()
 * surface.paint({ width, height, pixelRatio, fishLength, elapsedMs, reducedMotion, field })
 * ```
 */
export function createSurfacePainter(canvas: HTMLCanvasElement): SurfacePainter {
  let sizedTo = ''

  return {
    paint(frame) {
      const context = canvas.getContext('2d')
      if (context === null || frame.width === 0 || frame.height === 0) {
        return
      }
      const signature = `${frame.width}x${frame.height}@${frame.pixelRatio}`
      if (signature !== sizedTo) {
        // why: Assigning width resets the whole canvas state, so it only happens when the size actually changed.
        canvas.width = Math.round(frame.width * frame.pixelRatio)
        canvas.height = Math.round(frame.height * frame.pixelRatio)
        canvas.style.width = `${frame.width}px`
        canvas.style.height = `${frame.height}px`
        sizedTo = signature
      }
      context.setTransform(frame.pixelRatio, 0, 0, frame.pixelRatio, 0, 0)
      context.clearRect(0, 0, frame.width, frame.height)

      const damping = frame.reducedMotion ? REDUCED_MOTION_DAMPING : 1
      const drift = (frame.elapsedMs / 1000) * CAUSTIC_DRIFT_HZ * damping

      // how: Overlapping soft diagonal bands, each drifting at its own rate, read as sunlight refracting through a moving surface.
      context.globalCompositeOperation = 'lighter'
      for (let band = 0; band < CAUSTIC_BANDS; band += 1) {
        const phase = (drift * (1 + band * 0.34) + band * 0.37) % 1
        const offset = (phase - 0.25) * frame.width * 1.5
        const sheen = context.createLinearGradient(offset, 0, offset + frame.width * 0.55, frame.height)
        sheen.addColorStop(0, 'rgba(126, 214, 198, 0)')
        sheen.addColorStop(0.5, `rgba(150, 226, 210, ${0.035 * damping})`)
        sheen.addColorStop(1, 'rgba(126, 214, 198, 0)')
        context.fillStyle = sheen
        context.fillRect(0, 0, frame.width, frame.height)
      }
      context.globalCompositeOperation = 'source-over'

      for (const ripple of frame.field.ripples) {
        const resolved = resolveRipple(ripple, frame.fishLength)
        if (resolved.alpha <= 0.002 || resolved.radius <= 0) {
          continue
        }
        const alpha = resolved.alpha * damping
        context.beginPath()
        context.arc(resolved.origin.x, resolved.origin.y, resolved.radius, 0, Math.PI * 2)
        context.strokeStyle = `rgba(214, 245, 238, ${alpha * 0.75})`
        context.lineWidth = Math.max(1, frame.fishLength * 0.035 * resolved.alpha)
        context.stroke()

        // why: A second ring chasing the first at a shorter radius is what makes a strike read as a splash rather than a drawn circle.
        if (resolved.radius > frame.fishLength * 0.3) {
          context.beginPath()
          context.arc(resolved.origin.x, resolved.origin.y, resolved.radius * 0.62, 0, Math.PI * 2)
          context.strokeStyle = `rgba(190, 232, 226, ${alpha * 0.38})`
          context.lineWidth = Math.max(1, frame.fishLength * 0.018 * resolved.alpha)
          context.stroke()
        }
      }
    },
  }
}
