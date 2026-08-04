import { describe, expect, it } from 'vitest'
import {
  TOAST_MAX_DRIFT,
  TOAST_MAX_DURATION_MS,
  TOAST_MAX_SPIN_DEG,
  TOAST_MAX_START_RADIUS,
  TOAST_MIN_DRIFT,
  TOAST_MIN_DURATION_MS,
  TOAST_MIN_START_RADIUS,
  createFlatlineEdge,
  planToastFlight,
} from '../fx'

/**
 * Deterministic uniform source for sweeping the planner's random space.
 *
 * @param seed - Starting state for the generator.
 * @returns A uniform random source in [0, 1).
 */
function lcg(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 48271) % 2147483647
    return state / 2147483647
  }
}

const flights = Array.from({ length: 200 }, (_value, index) => planToastFlight(lcg(index + 1)))

describe('planToastFlight', () => {
  it('spawns near, but never directly at, the centre', () => {
    expect(
      flights.every((flight) => {
        const radius = Math.hypot(flight.startX, flight.startY)
        return radius >= TOAST_MIN_START_RADIUS && radius <= TOAST_MAX_START_RADIUS
      })
    ).toBe(true)
  })

  it('drifts outward along the spawn bearing', () => {
    expect(
      flights.every((flight) => {
        const drift = Math.hypot(flight.endX, flight.endY) - Math.hypot(flight.startX, flight.startY)
        return drift >= TOAST_MIN_DRIFT && drift <= TOAST_MAX_DRIFT
      })
    ).toBe(true)
  })

  it('keeps the flight duration inside the slow-fade band', () => {
    expect(flights.every((flight) => flight.durationMs >= TOAST_MIN_DURATION_MS && flight.durationMs <= TOAST_MAX_DURATION_MS)).toBe(true)
  })

  it('bounds the in-flight spin', () => {
    expect(flights.every((flight) => Math.abs(flight.spinDeg) <= TOAST_MAX_SPIN_DEG)).toBe(true)
  })
})

describe('createFlatlineEdge', () => {
  it('fires show once per flatline period and hide once on recovery', () => {
    const edge = createFlatlineEdge()
    const observed = [false, true, true, false, false, true].map((flat) => edge.evaluate(flat))
    expect(observed).toEqual(['none', 'show', 'none', 'hide', 'none', 'show'])
  })
})
