import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * Confine a number to the unit interval.
 *
 * @param value - Any number.
 * @returns The value, no less than 0 and no more than 1.
 */
export function clamp01(value: number): number {
  return min(1, max(0, value))
}

/**
 * Where a moment sits inside a span, as a fraction.
 *
 * The primitive every stage's motion is built from: a thing that starts at
 * one moment and takes a while is at `progress(atMs, startMs, durationMs)` of
 * its way, which is 0 before it starts and 1 once it is done.
 *
 * @param atMs - The moment being drawn.
 * @param startMs - When the span starts.
 * @param durationMs - How long the span runs; a span of no length is complete the instant it starts.
 * @returns Linear progress from 0 to 1.
 * @example Half way through a second-long move
 * ```ts
 * progress(500, 0, 1_000) // 0.5
 * ```
 */
export function progress(atMs: number, startMs: number, durationMs: number): number {
  if (durationMs <= 0) {
    return atMs >= startMs ? 1 : 0
  }
  return clamp01((atMs - startMs) / durationMs)
}

/**
 * Ease a linear progress so a move starts and ends gently.
 *
 * @param t - Linear progress from 0 to 1.
 * @returns Eased progress from 0 to 1.
 */
export function easeInOut(t: number): number {
  const u = clamp01(t)
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2
}

/**
 * Ease a linear progress so a move arrives gently after a quick start.
 *
 * @param t - Linear progress from 0 to 1.
 * @returns Eased progress from 0 to 1.
 */
export function easeOut(t: number): number {
  return 1 - (1 - clamp01(t)) ** 3
}

/**
 * Ease a linear progress so a move leaves gently after a slow start.
 *
 * @param t - Linear progress from 0 to 1.
 * @returns Eased progress from 0 to 1.
 */
export function easeIn(t: number): number {
  return clamp01(t) ** 3
}

/**
 * Interpolate between two numbers.
 *
 * @param from - The value at 0.
 * @param to - The value at 1.
 * @param t - Progress from 0 to 1, usually already eased.
 * @returns The value between them.
 */
export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/**
 * A pulse that rises and falls once over a span.
 *
 * For anything that lights up and settles again: an endpoint that just
 * received something, a node the traversal is standing on. Rises over the
 * first third, holds, and fades over the last third.
 *
 * @param atMs - The moment being drawn.
 * @param startMs - When the pulse begins.
 * @param durationMs - How long the whole pulse lasts.
 * @returns Intensity from 0 to 1.
 */
export function pulse(atMs: number, startMs: number, durationMs: number): number {
  const t = progress(atMs, startMs, durationMs)
  if (t <= 0 || t >= 1) {
    return 0
  }
  if (t < 1 / 3) {
    return easeOut(t * 3)
  }
  if (t > 2 / 3) {
    return 1 - easeIn((t - 2 / 3) * 3)
  }
  return 1
}
