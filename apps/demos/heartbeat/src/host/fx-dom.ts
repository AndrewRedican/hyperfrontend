/**
 * Thin DOM painter for the host's stage effects. All measurable geometry and
 * state logic lives in `fx.ts`; this file only creates elements over the
 * stage overlay and runs their Web Animations.
 */
import { planToastFlight } from './fx'

/** How long the skull takes to fully materialise before removing itself (ms). */
export const SKULL_DURATION_MS = 10000

/** The host's stage-effect painter. */
export interface StageFx {
  /** Spawns one toast sticker near the heart's centre, drifting outward while fading away. */
  spawnToast(): void
  /** Materialises the skull over the heart; it removes itself after {@link SKULL_DURATION_MS}. */
  showSkull(): void
  /** Removes the skull immediately; a no-op when it is not showing. */
  hideSkull(): void
}

/**
 * Reports whether the visitor prefers reduced motion.
 *
 * @returns `true` when motion should collapse to fades.
 */
function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Creates the stage-effect painter for the host's overlay layer.
 *
 * The layer sits above the embedded feature and is never clipped by it, so
 * host-owned effects can overlap the heart and drift past the hostee's
 * boundary while pointer events still reach the feature underneath.
 *
 * @param layer - The overlay element positioned over the stage.
 * @returns The {@link StageFx} handle.
 */
export function createStageFx(layer: HTMLElement): StageFx {
  const skull = document.createElement('img')
  skull.src = '/skull.svg'
  skull.alt = ''
  skull.className = 'fx-skull'
  skull.hidden = true
  layer.append(skull)
  let skullAnimation: Animation | null = null

  return {
    spawnToast() {
      const flight = planToastFlight(Math.random)
      const toast = document.createElement('div')
      toast.className = 'fx-toast'
      layer.append(toast)
      const centre = `translate(-50%, -50%)`
      const frames = reducedMotion()
        ? [
            { transform: `${centre} translate(${flight.startX}px, ${flight.startY}px)`, opacity: 0.95 },
            { transform: `${centre} translate(${flight.startX}px, ${flight.startY}px)`, opacity: 0 },
          ]
        : [
            { transform: `${centre} translate(${flight.startX}px, ${flight.startY}px) scale(0.55) rotate(0deg)`, opacity: 0.95 },
            {
              transform: `${centre} translate(${flight.endX}px, ${flight.endY}px) scale(1) rotate(${flight.spinDeg}deg)`,
              opacity: 0,
            },
          ]
      const animation = toast.animate(frames, { duration: flight.durationMs, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)' })
      animation.onfinish = () => {
        toast.remove()
      }
    },
    showSkull() {
      skullAnimation?.cancel()
      skull.hidden = false
      const frames = reducedMotion()
        ? [{ opacity: 0.12 }, { opacity: 0.85 }]
        : [
            { transform: 'translate(-50%, -50%) scale(0.55)', opacity: 0.12 },
            { transform: 'translate(-50%, -50%) scale(1.12)', opacity: 0.85 },
          ]
      skullAnimation = skull.animate(frames, { duration: SKULL_DURATION_MS, easing: 'linear', fill: 'forwards' })
      skullAnimation.onfinish = () => {
        // why: A flatline that outlives the full materialisation loses its skull — and must not grow another until the next flatline period.
        skull.hidden = true
        skullAnimation = null
      }
    },
    hideSkull() {
      if (skullAnimation !== null) {
        skullAnimation.cancel()
        skullAnimation = null
      }
      skull.hidden = true
    },
  }
}
