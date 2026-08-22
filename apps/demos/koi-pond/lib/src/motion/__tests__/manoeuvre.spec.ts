import { describe, expect, it } from 'vitest'
import type { NeighborObservation } from '../../model/types.js'
import { PASSING_SEPARATION } from '../../model/depth.js'
import type { KoiCrossing, KoiFlankField, KoiTurnTierWindows, KoiTurnTiers } from '../manoeuvre.js'
import { chooseTurnTier, flankCrowding } from '../manoeuvre.js'

/** The depth level every check swims at. */
const DEPTH = 3

/** A koi at the origin, pointed along positive x, that notices things a hundred pixels out. */
const SELF: Omit<KoiFlankField, 'neighbors'> = { position: { x: 0, y: 0 }, heading: 0, depth: DEPTH, reach: 100 }

/** Three tiers with round arcs, so a check reads as the ladder rather than as the trim. */
const TIERS: KoiTurnTiers = { subtle: { arc: 0.3, gain: 0.5 }, normal: { arc: 0.6, gain: 1 }, hard: { arc: 1, gain: 1.6 } }

/** Windows a second apart, so a check can place a crossing in one band by its distance alone. */
const WINDOWS: KoiTurnTierWindows = { hardS: 0.8, normalS: 1.6 }

/**
 * Places a neighbour.
 *
 * @param x - Its nose's x in pond space.
 * @param y - Its nose's y in pond space.
 * @param overrides - Anything else about it that matters to the check.
 * @returns The observation to read.
 */
function neighbor(x: number, y: number, overrides: Partial<NeighborObservation> = {}): NeighborObservation {
  return { framework: 'vue', x, y, heading: 0, speed: 0, depth: DEPTH, length: 100, girth: 10, ...overrides }
}

/**
 * Builds a crossing with a still neighbour a given way ahead and aside.
 *
 * At a hundred pixels a second, the neighbour's distance ahead is also the
 * seconds until the closest approach, so a check picks its tier band by placing
 * the fish.
 *
 * @param ahead - How far ahead the neighbour sits, in pixels.
 * @param aside - How far to the koi's right it sits, in pixels.
 * @param side - The flank the koi breaks toward.
 * @returns The crossing.
 */
function crossing(ahead: number, aside: number, side: -1 | 1 = 1): KoiCrossing {
  return {
    position: { x: 0, y: 0 },
    heading: 0,
    speed: 100,
    neighbor: neighbor(ahead, aside, { heading: Math.PI / 2 }),
    clearance: 60,
    side,
  }
}

describe('flankCrowding', () => {
  it('reads empty water as even', () => {
    expect(flankCrowding({ ...SELF, neighbors: [] })).toBe(0)
  })

  it('reads a neighbour off the right bow as crowding the right flank', () => {
    expect(flankCrowding({ ...SELF, neighbors: [neighbor(50, 50)] })).toBeGreaterThan(0)
  })

  it('reads its mirror image as crowding the left flank exactly as hard', () => {
    expect(flankCrowding({ ...SELF, neighbors: [neighbor(50, -50)] })).toBe(-flankCrowding({ ...SELF, neighbors: [neighbor(50, 50)] }))
  })

  it('takes no side from a neighbour dead ahead', () => {
    expect(flankCrowding({ ...SELF, neighbors: [neighbor(50, 0)] })).toBe(0)
  })

  it('takes no side from a neighbour astern', () => {
    expect(flankCrowding({ ...SELF, neighbors: [neighbor(-50, 50)] })).toBe(0)
  })

  it('takes no side from a neighbour beyond its reach', () => {
    expect(flankCrowding({ ...SELF, neighbors: [neighbor(100, 50)] })).toBe(0)
  })

  it('takes no side from a neighbour a passing separation away in depth', () => {
    expect(flankCrowding({ ...SELF, neighbors: [neighbor(50, 50, { depth: DEPTH - PASSING_SEPARATION })] })).toBe(0)
  })

  it('reads the nearer of two neighbours as the louder vote', () => {
    expect(flankCrowding({ ...SELF, neighbors: [neighbor(20, 20), neighbor(50, -50)] })).toBeGreaterThan(0)
  })
})

describe('chooseTurnTier', () => {
  it('leans at a crossing still a long way off, however poorly the lean clears it', () => {
    expect(chooseTurnTier(crossing(200, 0), TIERS, WINDOWS)).toBe('subtle')
  })

  it('leans at a nearer crossing a lean does clear', () => {
    expect(chooseTurnTier(crossing(100, -55), TIERS, WINDOWS)).toBe('subtle')
  })

  it('leans away from a neighbour whose closest approach the lean pushes past the horizon', () => {
    expect(chooseTurnTier({ ...crossing(0, 0), neighbor: neighbor(-50, 0, { heading: 0.262, speed: 100 }) }, TIERS, WINDOWS)).toBe('subtle')
  })

  it('breaks properly at a crossing no lean clears', () => {
    expect(chooseTurnTier(crossing(100, 0), TIERS, WINDOWS)).toBe('normal')
  })

  it('commits everything to a crossing that is nearly upon it', () => {
    expect(chooseTurnTier(crossing(50, 0), TIERS, WINDOWS)).toBe('hard')
  })

  it('breaks no harder than properly while the hard tier is still locked', () => {
    expect(chooseTurnTier(crossing(150, 0), TIERS, WINDOWS)).toBe('normal')
  })
})
