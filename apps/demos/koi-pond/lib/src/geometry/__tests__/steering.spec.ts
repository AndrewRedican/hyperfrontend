import type { NeighborObservation } from '../../model/types.js'
import type { EncounterSelf } from '../steering.js'
import { describe, expect, it } from 'vitest'
import { koiTraits } from '../../model/traits.js'
import {
  ENCOUNTER_HORIZON_S,
  closestApproach,
  createEncounterMemory,
  givesWay,
  headingAwayFrom,
  headingTo,
  resolveEncounter,
  turnToward,
  wanderOffset,
  wrapAngle,
} from '../steering.js'

/**
 * Builds a koi sitting at the origin, heading along +x.
 *
 * @param overrides - Fields to override.
 * @returns The koi the resolver is deciding for.
 */
function self(overrides: Partial<EncounterSelf> = {}): EncounterSelf {
  return {
    position: { x: 0, y: 0 },
    heading: 0,
    speed: 100,
    depth: 3,
    length: 120,
    girth: 14,
    traits: { ...koiTraits(1), depthWillingness: 0 },
    ...overrides,
  }
}

/**
 * Builds a neighbour on a collision course from the koi's right.
 *
 * @param overrides - Fields to override.
 * @returns The neighbour observation.
 */
function neighbor(overrides: Partial<NeighborObservation> = {}): NeighborObservation {
  return {
    framework: 'react',
    x: 100,
    y: 100,
    heading: -Math.PI / 2,
    speed: 100,
    depth: 3,
    length: 120,
    girth: 14,
    ...overrides,
  }
}

describe('wrapAngle', () => {
  it('leaves an angle already in range alone', () => {
    expect(wrapAngle(1)).toBeCloseTo(1)
  })

  it('folds a full turn back to nothing', () => {
    expect(wrapAngle(Math.PI * 2)).toBeCloseTo(0)
  })

  it('folds a turn past half a circle to the short way round', () => {
    expect(wrapAngle(Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2)
  })

  it('folds a negative overshoot the same way', () => {
    expect(wrapAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI / 2)
  })
})

describe('turnToward', () => {
  it('arrives when the turn is within reach', () => {
    expect(turnToward(0, 0.1, 0.5)).toBeCloseTo(0.1)
  })

  it('turns only as far as the koi can in one frame', () => {
    expect(turnToward(0, 3, 0.2)).toBeCloseTo(0.2)
  })

  it('takes the short way round rather than the long one', () => {
    // why: 3 to -3 is a tenth of a turn the short way and most of a turn the long way; the koi crosses the wrap point rather than sweeping back through zero.
    expect(turnToward(3, -3, 0.2)).toBeCloseTo(3.2 - Math.PI * 2, 5)
  })

  it('turns the other way when the target is behind on the other side', () => {
    expect(turnToward(0, -1, 0.3)).toBeCloseTo(-0.3)
  })
})

describe('headingTo', () => {
  it('points straight along +x for a target due right', () => {
    expect(headingTo({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0)
  })

  it('points down the screen for a target below', () => {
    expect(headingTo({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(Math.PI / 2)
  })
})

describe('headingAwayFrom', () => {
  it('points directly opposite the threat', () => {
    expect(headingAwayFrom({ x: 10, y: 0 }, { x: 0, y: 0 }, 1)).toBe(0)
  })

  it('holds course when the strike lands exactly on the nose', () => {
    expect(headingAwayFrom({ x: 5, y: 5 }, { x: 5, y: 5 }, 1.23)).toBe(1.23)
  })
})

describe('wanderOffset', () => {
  it('stays inside the band its two sines can reach', () => {
    const samples = Array.from({ length: 200 }, (_unused, index) => Math.abs(wanderOffset(7, index * 0.7)))
    expect(Math.max(...samples)).toBeLessThanOrEqual(1)
  })

  it('sends two koi with different seeds on different courses', () => {
    expect(wanderOffset(1, 12)).not.toBeCloseTo(wanderOffset(500, 12))
  })

  it('gives the same koi the same drift at the same moment', () => {
    expect(wanderOffset(9, 4.5)).toBe(wanderOffset(9, 4.5))
  })
})

describe('closestApproach', () => {
  it('sees two koi closing head-on', () => {
    const approach = closestApproach({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 400, y: 0 }, { x: -100, y: 0 })
    expect({ timeS: Math.round(approach.timeS * 100) / 100, distance: Math.round(approach.distance) }).toEqual({ timeS: 2, distance: 0 })
  })

  it('reports the present gap for two koi on identical courses', () => {
    expect(closestApproach({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 60 }, { x: 100, y: 0 })).toEqual({ timeS: 0, distance: 60 })
  })

  it('never predicts an approach in the past', () => {
    expect(closestApproach({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: -400, y: 0 }, { x: -100, y: 0 }).timeS).toBe(0)
  })
})

describe('resolveEncounter', () => {
  it('ignores a neighbour two depth levels away', () => {
    expect(resolveEncounter(self(), neighbor({ depth: 5 }), false).action).toBe('hold')
  })

  it('ignores a neighbour it will pass wide of', () => {
    expect(resolveEncounter(self(), neighbor({ x: 100, y: 900, heading: 0 }), false).action).toBe('hold')
  })

  it('ignores a crossing further ahead than it looks', () => {
    expect(resolveEncounter(self({ speed: 1 }), neighbor({ speed: 1 }), false).action).toBe('hold')
  })

  it('turns aside from a koi crossing its bow', () => {
    expect(resolveEncounter(self(), neighbor(), false).action).toBe('turn')
  })

  it('breaks away from where the crossing koi actually is', () => {
    expect(resolveEncounter(self(), neighbor(), false).turn).toBe(-1)
  })

  it('eases off rather than turning when overtaking from behind', () => {
    expect(resolveEncounter(self({ speed: 200 }), neighbor({ x: 130, y: 0, heading: 0, speed: 40 }), false).action).toBe('slow')
  })

  it('pushes on rather than turning when the faster koi is behind it', () => {
    expect(resolveEncounter(self({ speed: 40 }), neighbor({ x: -130, y: 0, heading: 0, speed: 200 }), false).action).toBe('accelerate')
  })

  it('dives under when it is the give-way koi and willing to change depth', () => {
    const bold = self({ traits: { ...koiTraits(1), depthWillingness: 0.9 } })
    expect(resolveEncounter(bold, neighbor(), true).action).toBe('pass-below')
  })

  it('rises over when it is the stand-on koi and willing to change depth', () => {
    const bold = self({ traits: { ...koiTraits(1), depthWillingness: 0.9 } })
    expect(resolveEncounter(bold, neighbor(), false).action).toBe('pass-above')
  })

  it('asks for a level clear enough to actually pass at', () => {
    const bold = self({ traits: { ...koiTraits(1), depthWillingness: 0.9 } })
    expect(resolveEncounter(bold, neighbor(), false).depth).toBe(5)
  })

  it('commits harder the closer the crossing gets', () => {
    const direct = resolveEncounter(self(), neighbor(), false)
    const glancing = resolveEncounter(self(), neighbor({ x: 60 }), false)
    expect(direct.urgency).toBeGreaterThan(glancing.urgency)
  })

  it('holds when the neighbour is further off than the horizon reaches', () => {
    const distant = neighbor({ x: 100 * ENCOUNTER_HORIZON_S * 4, y: 100 * ENCOUNTER_HORIZON_S * 4 })
    expect(resolveEncounter(self(), distant, false).action).toBe('hold')
  })
})

describe('resolveEncounter clearance', () => {
  it('claims more water for a pair of broad koi than a pair of slender ones', () => {
    // why: This crossing passes about 113 px clear — past the slender pair's clearance, inside the broad pair's.
    const wide = resolveEncounter(self({ girth: 40 }), neighbor({ x: 100, y: 260, girth: 40 }), false)
    const slender = resolveEncounter(self({ girth: 8 }), neighbor({ x: 100, y: 260, girth: 8 }), false)
    expect({ wide: wide.action, slender: slender.action }).toEqual({ wide: 'turn', slender: 'hold' })
  })
})

describe('createEncounterMemory', () => {
  it('keeps the first chosen side while the encounter persists', () => {
    const memory = createEncounterMemory()
    const first = memory.resolve(self(), neighbor(), false, 0)
    // why: A neighbour drifting across the bow flips the raw bearing sign; the memory must keep re-issuing the side it first chose.
    const crossed = memory.resolve(self(), neighbor({ x: 100, y: -100, heading: Math.PI / 2 }), false, 0.1)
    expect({ first: first.turn, crossed: crossed.turn }).toEqual({ first: -1, crossed: -1 })
  })

  it('would have turned the other way without the memory', () => {
    expect(resolveEncounter(self(), neighbor({ x: 100, y: -100, heading: Math.PI / 2 }), false).turn).toBe(1)
  })

  it('releases the side once the encounter has been clear long enough', () => {
    const memory = createEncounterMemory()
    memory.resolve(self(), neighbor(), false, 0)
    memory.resolve(self(), neighbor({ x: 4000, y: 4000 }), false, 1)
    const fresh = memory.resolve(self(), neighbor({ x: 100, y: -100, heading: Math.PI / 2 }), false, 2)
    expect(fresh.turn).toBe(1)
  })

  it('remembers each neighbour separately', () => {
    const memory = createEncounterMemory()
    memory.resolve(self(), neighbor(), false, 0)
    const other = memory.resolve(self(), neighbor({ framework: 'vue', x: 100, y: -100, heading: Math.PI / 2 }), false, 0.1)
    expect(other.turn).toBe(1)
  })

  it('passes non-turn resolutions through untouched', () => {
    const memory = createEncounterMemory()
    const resolution = memory.resolve(self({ speed: 200 }), neighbor({ x: 130, y: 0, heading: 0, speed: 40 }), false, 0)
    expect(resolution.action).toBe('slow')
  })
})

describe('givesWay', () => {
  it('hands the give-way side to the earlier slug', () => {
    expect(givesWay('lit', 'vue')).toBe(true)
  })

  it('hands the stand-on side to the later slug', () => {
    expect(givesWay('vue', 'lit')).toBe(false)
  })

  it('reaches opposite conclusions in the two frames of one pair', () => {
    expect(givesWay('preact', 'svelte')).not.toBe(givesWay('svelte', 'preact'))
  })
})
