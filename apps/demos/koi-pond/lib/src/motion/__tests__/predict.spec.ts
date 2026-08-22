import { describe, expect, it } from 'vitest'
import type { KoiFlight, KoiFlightTerms } from '../predict.js'
import { stepFlight } from '../predict.js'

/** The step every check advances by, in seconds. */
const DT = 0.125

/** The terms a bare integrator check steps with: a fixed heading, full commitment, and an unwavering pace. */
function bareTerms(desired: number, speed: number): KoiFlightTerms {
  return {
    aim: () => ({ heading: desired, gain: 1 }),
    helm: 0.8,
    targetSpeed: () => speed,
    moves: true,
    fishLength: 400,
    cruiseCeilingBlS: 0.62,
    speedEase: 3.2,
    accelLimitBlS2: 2.6,
    turnAccel: 2.2,
    turnApproach: 1.8,
    turnSpeedTax: 0.45,
  }
}

/** A koi flight parked at the origin, pointed along positive x. */
function bareFlight(speed: number): KoiFlight {
  return { position: { x: 0, y: 0 }, heading: 0, speed, turnVelocity: 0, atS: 0 }
}

describe('stepFlight', () => {
  it('leaves the flight it was given untouched', () => {
    const flight = bareFlight(100)
    const before = { ...flight, position: { ...flight.position } }
    stepFlight(flight, bareTerms(1, 100), DT)
    expect(flight).toEqual(before)
  })

  it('carries the nose along the heading it has just taken', () => {
    const stepped = stepFlight(bareFlight(120), bareTerms(0, 120), 0.5)
    expect(stepped.heading).toBeCloseTo(0, 12)
    expect(stepped.position.x).toBeCloseTo(60, 6)
    expect(stepped.position.y).toBeCloseTo(0, 12)
  })

  it('winds the turn rate up under its acceleration bound rather than stepping to it', () => {
    const terms = bareTerms(Math.PI / 2, 100)
    const stepped = stepFlight(bareFlight(100), terms, DT)
    expect(stepped.turnVelocity).toBeCloseTo(terms.turnAccel * DT, 12)
  })

  it('holds a koi that is elsewhere in place while it still carries a heading and a pace', () => {
    const terms = { ...bareTerms(1, 100), moves: false }
    const stepped = stepFlight(bareFlight(100), terms, DT)
    expect(stepped.position).toEqual({ x: 0, y: 0 })
    expect(stepped.heading).not.toBe(0)
  })

  it('reads the pull at the clock the step lands on', () => {
    const seen: number[] = []
    const terms: KoiFlightTerms = { ...bareTerms(0, 100), aim: (_at, facing, atS) => (seen.push(atS), { heading: facing, gain: 1 }) }
    stepFlight({ ...bareFlight(100), atS: 4 }, terms, DT)
    expect(seen).toEqual([4 + DT])
  })
})
