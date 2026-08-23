import { describe, expect, it } from 'vitest'
import type { Disturbance, KoiFramework, NeighborObservation, PondEnvironment, Vec2 } from '../../model/types.js'
import { describePond, entryStation } from '../../geometry/virtual-pond.js'
import { wrapAngle } from '../../geometry/steering.js'
import { koiProfile, koiSeed } from '../../model/traits.js'
import type { KoiDecisionCause, KoiMotion, KoiMotionInit } from '../koi-motion.js'
import { DEFAULT_MOTION_TRIM, createKoiMotion } from '../koi-motion.js'
import type { KoiFlight, KoiFlightTerms } from '../predict.js'
import { KOI_PATH_MAX_POINTS, predictFlight, stepFlight } from '../predict.js'

/**
 * The step every horizon is predicted and replayed at, in seconds.
 *
 * An exact binary fraction, and longer than the decision interval, so a replayed
 * clock accumulates without drift and lands on the same judgement beats the
 * prediction assumed it would.
 */
const DT = 0.125

/** How far a realized nose may sit from the point that predicted it, in CSS pixels. */
const TOLERANCE = 0.5

/** The shortest horizon a parity scenario may compare before its koi decides something new. */
const MIN_COMPARED = 10

/** The depth level a koi enters the pond at. */
const ENTRY_DEPTH = 3

/**
 * Builds the pond the checks swim in.
 *
 * @returns The environment.
 */
function pond(): PondEnvironment {
  return describePond(1920, 1080, 900, 600, false)
}

/**
 * Places a koi at its canonical opening station.
 *
 * @param framework - The framework slug rendering it.
 * @param world - The world it swims in.
 * @returns Everything the brain needs to be born.
 */
function born(framework: KoiFramework, world: PondEnvironment): KoiMotionInit {
  const entry = entryStation(world, koiSeed(framework))
  return { profile: koiProfile(framework), pond: world, position: entry.position, heading: entry.heading, depth: ENTRY_DEPTH }
}

/** A koi under a watch that reports what it last committed to. */
interface Watched {
  /** The brain. */
  motion: KoiMotion
  /** What it last committed to, or `null` before its first frame. */
  committed(): KoiDecisionCause | null
}

/**
 * Builds a koi whose committed decisions are observable.
 *
 * @param init - Everything the brain needs to be born.
 * @returns The brain and the watch on it.
 */
function watched(init: KoiMotionInit): Watched {
  let last: KoiDecisionCause | null = null
  const motion = createKoiMotion(init, {
    onDecision: (decision) => {
      // why: A granted depth pass is vertical, so it settles nothing about where the koi is steering and must not count as parting from the horizontal manoeuvre a horizon was predicted for.
      if (decision.kind !== 'depth-change') {
        last = decision.cause
      }
    },
  })
  return { motion, committed: () => last }
}

/**
 * Runs a koi for a stretch of simulated time.
 *
 * @param motion - The brain to drive.
 * @param frames - How many steps to advance.
 * @param each - Optional per-frame work.
 */
function swim(motion: KoiMotion, frames: number, each: () => void = () => {}): void {
  for (let frame = 0; frame < frames; frame += 1) {
    each()
    motion.advance(DT)
  }
}

/** What replaying a predicted horizon against the koi that predicted it turned up. */
interface Replay {
  /** How far the realized nose sat from the point that predicted it, per compared step. */
  gaps: number[]
  /** What the koi committed to instead, or `null` when it held its manoeuvre for the whole horizon. */
  parted: KoiDecisionCause | null
}

/**
 * Predicts a horizon, then swims it and measures what the koi actually did.
 *
 * Comparison stops the moment the koi commits to something new or leaves the
 * pond, because a prediction deliberately knows nothing about either.
 *
 * @param watch - The koi and the watch on it.
 * @param steps - How long a horizon to predict.
 * @returns The measured horizon.
 */
function replay(watch: Watched, steps: number): Replay {
  const { motion } = watch
  const path = motion.predictPath(steps, DT)
  const at = watch.committed()
  const gaps: number[] = []
  for (const point of path) {
    motion.advance(DT)
    if (watch.committed() !== at || motion.isAway) {
      return { gaps, parted: watch.committed() }
    }
    const { position } = motion.state
    gaps.push(Math.hypot(position.x - point.x, position.y - point.y))
  }
  return { gaps, parted: null }
}

/**
 * Reads a koi as its neighbours see it.
 *
 * @param motion - The koi being observed.
 * @param framework - Its framework slug.
 * @returns The observation to relay.
 */
function observationOf(motion: KoiMotion, framework: KoiFramework): NeighborObservation {
  const { position, heading, speed, depth, length } = motion.state
  return { framework, x: position.x, y: position.y, heading, speed, depth, length, girth: length * 0.24 }
}

/**
 * A koi gliding along its itinerary with nothing pulling at it.
 *
 * @returns The koi and the watch on it.
 */
function gliding(): Watched {
  const watch = watched(born('react', pond()))
  swim(watch.motion, 200)
  return watch
}

/**
 * A koi with a turn wound on, pushed off the shore it was swimming at.
 *
 * @returns The koi and the watch on it.
 */
function turning(): Watched {
  const world = pond()
  const watch = watched({ ...born('angular', world), position: { x: world.fishLength * 1.4, y: world.height / 2 }, heading: Math.PI })
  swim(watch.motion, 10)
  return watch
}

/**
 * A koi braking into a committed break around a neighbour crossing its bow.
 *
 * @returns The koi and the watch on it.
 */
function braking(): Watched {
  const world = pond()
  const watch = watched({ ...born('react', world), position: { x: world.width / 2, y: world.height / 2 }, heading: 0 })
  const neighbor = { ...observationOf(watch.motion, 'solid'), x: world.width / 2 + world.fishLength * 1.2, heading: Math.PI, speed: 150 }
  swim(watch.motion, 8, () => watch.motion.observe([neighbor]))
  return watch
}

/**
 * A koi bolting from a strike beside it.
 *
 * @returns The koi and the watch on it.
 */
function bolting(): Watched {
  const world = pond()
  const watch = watched(born('svelte', world))
  swim(watch.motion, 40)
  const here = watch.motion.state.position
  const strike: Disturbance = { x: here.x + world.fishLength * 0.5, y: here.y + world.fishLength * 0.5, intensity: 1 }
  expect(watch.motion.startle(strike)).toBe(true)
  swim(watch.motion, 3)
  return watch
}

/**
 * The bearing from one point to the next.
 *
 * @param from - The earlier point.
 * @param to - The later point.
 * @returns The bearing in radians.
 */
function bearing(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x)
}

/**
 * How far a path travels, following it point to point.
 *
 * @param from - Where the path starts.
 * @param path - The points it runs through.
 * @returns The arc length in CSS pixels.
 */
function arcLength(from: Vec2, path: readonly Vec2[]): number {
  let travelled = 0
  let previous = from
  for (const point of path) {
    travelled += Math.hypot(point.x - previous.x, point.y - previous.y)
    previous = point
  }
  return travelled
}

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

describe('predictFlight', () => {
  it('caps the horizon however many steps are asked for', () => {
    expect(predictFlight(bareFlight(100), bareTerms(0, 100), 500, DT)).toHaveLength(KOI_PATH_MAX_POINTS)
  })

  it('predicts nothing for a step that is not a stretch of time', () => {
    expect(predictFlight(bareFlight(100), bareTerms(0, 100), 20, 0)).toEqual([])
    expect(predictFlight(bareFlight(100), bareTerms(0, 100), 20, -DT)).toEqual([])
    expect(predictFlight(bareFlight(100), bareTerms(0, 100), 20, Number.NaN)).toEqual([])
  })

  it('predicts nothing for a horizon of no steps', () => {
    expect(predictFlight(bareFlight(100), bareTerms(0, 100), 0, DT)).toEqual([])
    expect(predictFlight(bareFlight(100), bareTerms(0, 100), -4, DT)).toEqual([])
  })

  it('hands out points of its own rather than the flight it was given', () => {
    const flight = bareFlight(100)
    const path = predictFlight(flight, { ...bareTerms(0, 100), moves: false }, 3, DT)
    expect(path).toHaveLength(3)
    for (const point of path) {
      expect(point).not.toBe(flight.position)
    }
  })
})

describe('predictPath', () => {
  it('clamps its point count at the cap the wire carries', () => {
    const { motion } = gliding()
    expect(motion.predictPath(500, DT)).toHaveLength(KOI_PATH_MAX_POINTS)
    expect(motion.predictPath(KOI_PATH_MAX_POINTS, DT)).toHaveLength(KOI_PATH_MAX_POINTS)
    expect(motion.predictPath(6, DT)).toHaveLength(6)
    expect(motion.predictPath(0, DT)).toEqual([])
    expect(motion.predictPath(20, 0)).toEqual([])
  })

  it('predicts the same horizon twice and leaves the koi where it found it', () => {
    const { motion } = gliding()
    const before = motion.state
    const first = motion.predictPath(KOI_PATH_MAX_POINTS, DT)
    const second = motion.predictPath(KOI_PATH_MAX_POINTS, DT)
    expect(second).toEqual(first)
    expect(motion.state.position).toEqual(before.position)
    expect(motion.state.heading).toBe(before.heading)
    expect(motion.state.speed).toBe(before.speed)
    expect(motion.state.turnVelocity).toBe(before.turnVelocity)
  })

  it('predicts the same horizon for two koi that have lived the same life', () => {
    expect(gliding().motion.predictPath(KOI_PATH_MAX_POINTS, DT)).toEqual(gliding().motion.predictPath(KOI_PATH_MAX_POINTS, DT))
  })

  it('predicts a straight line at cruise spacing for a koi holding its course', () => {
    const { motion } = gliding()
    const { position, speed, turnVelocity } = motion.state
    expect(Math.abs(turnVelocity)).toBeLessThan(DEFAULT_MOTION_TRIM.turningEnter)
    const path = motion.predictPath(KOI_PATH_MAX_POINTS, DT)
    let previous = position
    for (const point of path) {
      // how: Spacing is the koi's own pace over one step, give or take the pace it is easing onto, which is what makes the drawn points read as a rhythm rather than a decoration.
      const spacing = Math.hypot(point.x - previous.x, point.y - previous.y) / (speed * DT)
      expect(spacing).toBeGreaterThan(0.9)
      expect(spacing).toBeLessThan(1.1)
      previous = point
    }
    const bearings = [bearing(position, path[0]!), ...path.slice(1).map((point, index) => bearing(path[index]!, point))]
    // how: A cruising koi drifts onto its course rather than steering there, so no step of its path may bend at the rate that would read as a turn.
    for (const [index, angle] of bearings.slice(1).entries()) {
      expect(Math.abs(wrapAngle(angle - bearings[index]!))).toBeLessThan(DEFAULT_MOTION_TRIM.turningExit * DT)
    }
  })

  it('predicts a curve whose curvature and arc length are the manoeuvre the koi has wound on', () => {
    const { motion } = turning()
    const { position, speed, turnVelocity } = motion.state
    expect(Math.abs(turnVelocity)).toBeGreaterThan(DEFAULT_MOTION_TRIM.turningEnter)
    const path = motion.predictPath(KOI_PATH_MAX_POINTS, DT)
    const bearings = [bearing(position, path[0]!), ...path.slice(1).map((point, index) => bearing(path[index]!, point))]
    const swept = bearings.slice(1).map((angle, index) => wrapAngle(angle - bearings[index]!))
    // how: One step of a curve turns by the rate the koi is carrying, which is what makes the pearls bend with the fish rather than pointing where it was aimed.
    expect(swept[0]).toBeCloseTo(turnVelocity * DT, 1)
    for (const step of swept) {
      expect(Math.sign(step)).toBe(Math.sign(turnVelocity))
    }
    expect(arcLength(position, path)).toBeCloseTo(speed * KOI_PATH_MAX_POINTS * DT, -1)
  })

  it('predicts nothing beyond the pond for a koi that has slipped out of it', () => {
    const world = pond()
    const { motion } = watched({ ...born('preact', world), position: { x: world.fishLength, y: world.height / 2 }, heading: Math.PI })
    for (let frame = 0; frame < 2000 && !motion.isAway; frame += 1) {
      motion.advance(DT)
    }
    expect(motion.isAway).toBe(true)
    // why: A koi waiting out its absence is not in the pond at all, so the only honest advancement to draw for it is none.
    for (const point of motion.predictPath(KOI_PATH_MAX_POINTS, DT)) {
      expect(point).toEqual(motion.state.position)
    }
  })
})

describe('realized-trajectory parity', () => {
  const scenarios: readonly (readonly [string, () => Watched, number])[] = [
    ['straight', gliding, KOI_PATH_MAX_POINTS],
    ['turning', turning, KOI_PATH_MAX_POINTS],
    // why: The braking koi keeps the last neighbour it was relayed, and swims far enough past it in two seconds that the crossing settles at a different effort; beyond that the koi has re-committed, which is precisely what a prediction never claims to know.
    ['braking', braking, 16],
    ['bolting', bolting, KOI_PATH_MAX_POINTS],
  ]

  for (const [name, scenario, steps] of scenarios) {
    it(`swims through every point it predicted from a ${name} state`, () => {
      const { gaps } = replay(scenario(), steps)
      expect(gaps.length).toBeGreaterThanOrEqual(MIN_COMPARED)
      for (const gap of gaps) {
        expect(gap).toBeLessThanOrEqual(TOLERANCE)
      }
    })
  }

  it('parts from a horizon only where the koi decided something new', () => {
    const watch = braking()
    const { gaps, parted } = replay(watch, KOI_PATH_MAX_POINTS)
    // why: A koi that held its manoeuvre for the whole horizon proves the parity is the integrator's rather than an artefact of stopping early.
    expect(parted === null || gaps.length < KOI_PATH_MAX_POINTS).toBe(true)
  })

  it('predicts a fresh manoeuvre the frame a koi commits to one', () => {
    const world = pond()
    const watch = watched(born('vue', world))
    swim(watch.motion, 40)
    const calm = watch.motion.predictPath(KOI_PATH_MAX_POINTS, DT)
    const here = watch.motion.state.position
    expect(watch.motion.startle({ x: here.x + world.fishLength * 0.4, y: here.y, intensity: 1 })).toBe(true)
    watch.motion.advance(DT)
    const bolt = watch.motion.predictPath(KOI_PATH_MAX_POINTS, DT)
    const strayed = bolt.map((point, index) => Math.hypot(point.x - calm[index]!.x, point.y - calm[index]!.y))
    expect(Math.max(...strayed)).toBeGreaterThan(world.fishLength)
    const { gaps } = replay(watch, KOI_PATH_MAX_POINTS)
    expect(gaps.length).toBeGreaterThanOrEqual(MIN_COMPARED)
    for (const gap of gaps) {
      expect(gap).toBeLessThanOrEqual(TOLERANCE)
    }
  })
})
