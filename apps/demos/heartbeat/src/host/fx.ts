/**
 * Pure geometry and state logic for the host's stage effects — the toast
 * stickers that pop off extra beats and the skull that haunts a flatline.
 * The DOM painter stays thin; everything measurable lives here.
 */

/** Closest a toast may spawn to the heart's centre (px) — near, never on it. */
export const TOAST_MIN_START_RADIUS = 36
/** Farthest a toast may spawn from the heart's centre (px). */
export const TOAST_MAX_START_RADIUS = 90
/** Shortest outward drift a toast travels while fading (px). */
export const TOAST_MIN_DRIFT = 110
/** Longest outward drift a toast travels while fading (px). */
export const TOAST_MAX_DRIFT = 190
/** Shortest toast flight duration (ms). */
export const TOAST_MIN_DURATION_MS = 2600
/** Longest toast flight duration (ms). */
export const TOAST_MAX_DURATION_MS = 3800
/** Largest signed rotation a toast picks up in flight (deg). */
export const TOAST_MAX_SPIN_DEG = 30

/** One planned toast flight, as offsets from the heart's centre. */
export interface ToastFlight {
  /** Horizontal spawn offset (px). */
  startX: number
  /** Vertical spawn offset (px). */
  startY: number
  /** Horizontal offset at the end of the outward drift (px). */
  endX: number
  /** Vertical offset at the end of the outward drift (px). */
  endY: number
  /** Flight duration (ms). */
  durationMs: number
  /** Signed rotation picked up over the flight (deg). */
  spinDeg: number
}

/**
 * Plans one toast flight: a random position near — but never directly at —
 * the heart's centre, drifting slowly outward along the same bearing.
 *
 * @param random - Uniform random source in [0, 1).
 * @returns The planned {@link ToastFlight}.
 */
export function planToastFlight(random: () => number): ToastFlight {
  const angle = random() * 2 * Math.PI
  const startRadius = TOAST_MIN_START_RADIUS + random() * (TOAST_MAX_START_RADIUS - TOAST_MIN_START_RADIUS)
  const endRadius = startRadius + TOAST_MIN_DRIFT + random() * (TOAST_MAX_DRIFT - TOAST_MIN_DRIFT)
  return {
    startX: Math.cos(angle) * startRadius,
    startY: Math.sin(angle) * startRadius,
    endX: Math.cos(angle) * endRadius,
    endY: Math.sin(angle) * endRadius,
    durationMs: TOAST_MIN_DURATION_MS + random() * (TOAST_MAX_DURATION_MS - TOAST_MIN_DURATION_MS),
    spinDeg: (random() * 2 - 1) * TOAST_MAX_SPIN_DEG,
  }
}

/** Edge detector over the host's flatline judgement. */
export interface FlatlineEdge {
  /**
   * Feeds the current flatline judgement and reports the transition.
   *
   * @param flat - The current judgement.
   * @returns `'show'` on the rising edge (a new flatline period began), `'hide'` on the falling edge, `'none'` otherwise.
   */
  evaluate(flat: boolean): 'show' | 'hide' | 'none'
}

/**
 * Creates the flatline edge detector that paces the skull: exactly one
 * `'show'` per uninterrupted flatline period, because a new rising edge
 * cannot occur until the period ends with a falling edge.
 *
 * @returns The {@link FlatlineEdge} detector, starting from a live rhythm.
 */
export function createFlatlineEdge(): FlatlineEdge {
  let prevFlat = false
  return {
    evaluate(flat) {
      if (flat === prevFlat) {
        return 'none'
      }
      prevFlat = flat
      return flat ? 'show' : 'hide'
    },
  }
}
