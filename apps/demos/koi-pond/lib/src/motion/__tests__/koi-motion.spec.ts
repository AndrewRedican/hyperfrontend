import type { Disturbance, PondEnvironment } from '../../model/types.js'
import { describe, expect, it } from 'vitest'
import { describePond, entryStation } from '../../geometry/virtual-pond.js'
import { wrapAngle } from '../../geometry/steering.js'
import { koiProfile, koiSeed } from '../../model/traits.js'
import type { KoiDecision, KoiMotionInit, KoiMotionOptions } from '../koi-motion.js'
import { DEFAULT_MOTION_LIMITS, DEFAULT_MOTION_TRIM, createKoiMotion } from '../koi-motion.js'
import { GOLDEN_TRACE } from './golden-trace.js'
import { traceScenarios } from './trajectory.js'

/** The frame step every check advances by, in seconds. */
const DT = 1 / 60

/** The depth level a koi enters the pond at. */
const ENTRY_DEPTH = 3

/**
 * Builds the pond the checks swim in.
 *
 * @param reducedMotion - Whether the visitor asked for reduced motion.
 * @returns The environment.
 */
function pond(reducedMotion = false): PondEnvironment {
  return describePond(1920, 1080, 900, 600, reducedMotion)
}

/**
 * Places a koi at its canonical opening station.
 *
 * @param framework - The framework slug rendering it.
 * @param world - The world it swims in.
 * @returns Everything the brain needs to be born.
 */
function born(framework: 'react' | 'svelte' | 'lit', world: PondEnvironment): KoiMotionInit {
  const entry = entryStation(world, koiSeed(framework))
  return { profile: koiProfile(framework), pond: world, position: entry.position, heading: entry.heading, depth: ENTRY_DEPTH }
}

/**
 * Runs a koi for a stretch of simulated time.
 *
 * @param motion - The brain to drive.
 * @param seconds - How long to run for.
 * @param each - Optional per-frame work, given the frame's simulated second.
 */
function swim(motion: { advance(dt: number): void }, seconds: number, each: (second: number) => void = () => {}): void {
  const frames = Math.round(seconds / DT)
  for (let frame = 1; frame <= frames; frame += 1) {
    each(frame * DT)
    motion.advance(DT)
  }
}

/**
 * The peak speed a koi reaches while it flees a strike landing on its nose.
 *
 * @param reducedMotion - Whether the visitor asked for reduced motion.
 * @returns The peak speed in pixels per second.
 */
function peakEscapeSpeed(reducedMotion: boolean): number {
  const world = pond(reducedMotion)
  const init = born('svelte', world)
  // why: A ten-second escape band lets the speed ease settle onto its target, so the reading is the damping itself rather than where the acceleration limit happened to be when the bolt expired.
  const motion = createKoiMotion(init, { trim: { escapeS: { min: 10, max: 10 } } })
  const strike: Disturbance = { x: init.position.x, y: init.position.y, intensity: 1 }
  expect(motion.startle(strike)).toBe(true)
  let peak = 0
  swim(motion, 9)
  peak = Math.max(peak, motion.state.speed)
  return peak
}

describe('createKoiMotion', () => {
  it('swims every scenario exactly as the shared brain does', () => {
    expect(traceScenarios(createKoiMotion)).toEqual(GOLDEN_TRACE)
  })

  it('is unchanged by hooks that observe and pass through', () => {
    const options: KoiMotionOptions = { onDecision: () => {}, desire: (wanted) => wanted }
    expect(traceScenarios((init) => createKoiMotion(init, options))).toEqual(GOLDEN_TRACE)
  })

  it('is unchanged by spelling out the default trim and limits', () => {
    const options: KoiMotionOptions = { trim: DEFAULT_MOTION_TRIM, limits: DEFAULT_MOTION_LIMITS }
    expect(traceScenarios((init) => createKoiMotion(init, options))).toEqual(GOLDEN_TRACE)
  })

  it('gives every koi its own body, clock, and judgement', () => {
    const world = pond()
    const first = createKoiMotion(born('react', world))
    const second = createKoiMotion(born('react', world))
    swim(first, 5)
    expect(second.state.position).not.toEqual(first.state.position)
    swim(second, 5)
    expect(second.state.position).toEqual(first.state.position)
  })
})

describe('createKoiMotion trim', () => {
  it('takes a slower cruise band without touching the rest of the judgement', () => {
    const world = pond()
    const init = born('react', world)
    const stock = createKoiMotion(init)
    const dawdler = createKoiMotion(init, { trim: { cruiseBlS: { min: 0.05, max: 0.1 } } })
    swim(stock, 20)
    swim(dawdler, 20)
    expect(dawdler.state.speed).toBeLessThan(stock.state.speed)
  })

  it('obeys a lowered speed ceiling however hard the koi bolts', () => {
    const world = pond()
    const init = born('svelte', world)
    const motion = createKoiMotion(init, { limits: { maxSpeedBlS: 0.5 } })
    motion.startle({ x: init.position.x, y: init.position.y, intensity: 1 })
    let peak = 0
    swim(motion, 6, () => {
      peak = Math.max(peak, motion.state.speed)
    })
    expect(peak).toBeLessThanOrEqual(world.fishLength * 0.5)
  })

  it('still damps a reduced-motion escape to its share of a full one', () => {
    const damped = peakEscapeSpeed(true)
    const full = peakEscapeSpeed(false)
    expect(damped).toBeLessThan(full)
    expect(damped / full).toBeCloseTo(DEFAULT_MOTION_TRIM.reducedMotionDamping, 6)
  })

  it('holds a roll between depth levels for as long as the trim says', () => {
    const world = pond()
    const motion = createKoiMotion(born('react', world), { trim: { depthRollS: 4 } })
    motion.setDepth(1)
    swim(motion, 3)
    expect(motion.state.phase).toBe('depth-transition')
    swim(motion, 1.5)
    expect(motion.state.phase).not.toBe('depth-transition')
  })
})

describe('createKoiMotion decision observer', () => {
  it('reports a flee the moment the koi commits to it', () => {
    const world = pond()
    const init = born('svelte', world)
    const decisions: KoiDecision[] = []
    const motion = createKoiMotion(init, { onDecision: (decision) => decisions.push(decision) })
    swim(motion, 2)
    motion.startle({ x: init.position.x, y: init.position.y, intensity: 1 })
    swim(motion, 2)
    const flee = decisions.find((decision) => decision.cause === 'flee')
    expect(flee).toEqual({ atS: expect.any(Number), cause: 'flee', kind: 'avoid', heading: expect.any(Number), gain: 1.7, depth: null })
  })

  it('reports a decided depth pass with the level it asks the host for', () => {
    const world = pond()
    const centre = { x: world.width / 2, y: world.height / 2 }
    const reach = world.fishLength * 1.4
    const decisions: KoiDecision[] = []
    const one = createKoiMotion(
      { ...born('lit', world), position: { x: centre.x - reach, y: centre.y }, heading: 0 },
      { onDecision: (decision) => decisions.push(decision) }
    )
    const two = createKoiMotion({ ...born('svelte', world), position: { x: centre.x + reach, y: centre.y }, heading: Math.PI })
    const profile = koiProfile('svelte')
    swim(one, 6, () => {
      const other = two.state
      one.observe([
        {
          framework: 'svelte',
          x: other.position.x,
          y: other.position.y,
          heading: other.heading,
          speed: other.speed,
          depth: other.depth,
          length: other.length,
          girth: other.length * profile.build.girthRatio,
        },
      ])
      two.advance(DT)
    })
    const pass = decisions.find((decision) => decision.cause === 'pass')
    expect(pass).toEqual({
      atS: expect.any(Number),
      cause: 'pass',
      kind: 'depth-change',
      heading: null,
      gain: expect.any(Number),
      depth: expect.any(Number),
    })
    expect(pass?.depth).toBe(one.state.depth - 2)
  })

  it('speaks once per decision rather than once per frame', () => {
    const decisions: KoiDecision[] = []
    const motion = createKoiMotion(born('react', pond()), { onDecision: (decision) => decisions.push(decision) })
    swim(motion, 60)
    expect(decisions.length).toBeGreaterThan(1)
    expect(decisions.length).toBeLessThan(60)
    // why: A repeated cause would mean the same standing intention was reported twice running, which is the frame-by-frame chatter the observer exists to avoid.
    const repeated = decisions.filter((decision, index) => index > 0 && decision.cause === decisions[index - 1]?.cause)
    expect(repeated).toEqual([])
  })

  it('says nothing when nobody is listening', () => {
    expect(() => swim(createKoiMotion(born('react', pond())), 30)).not.toThrow()
  })
})

describe('createKoiMotion desire override', () => {
  it('steers the koi wherever the override asks', () => {
    const motion = createKoiMotion(born('react', pond()), { desire: () => ({ heading: 0, gain: 1, kind: 'travel' }) })
    swim(motion, 20)
    expect(Math.abs(wrapAngle(motion.state.heading))).toBeLessThan(0.01)
  })

  it('is handed the desire the koi formed for itself, and its cause', () => {
    const seen: string[] = []
    const motion = createKoiMotion(born('react', pond()), {
      desire: (wanted, context) => {
        seen.push(context.cause)
        expect(context.pond.width).toBe(1920)
        expect(context.position).toEqual(motion.state.position)
        return wanted
      },
    })
    swim(motion, 30)
    expect(new Set(seen)).toEqual(new Set(['glide', 'turn']))
  })

  it('reports the overridden heading rather than the one it replaced', () => {
    const decisions: KoiDecision[] = []
    const motion = createKoiMotion(born('react', pond()), {
      desire: () => ({ heading: 0, gain: 1, kind: 'avoid' }),
      onDecision: (decision) => decisions.push(decision),
    })
    swim(motion, 5)
    expect(decisions.map((decision) => ({ kind: decision.kind, heading: decision.heading }))).toContainEqual({ kind: 'avoid', heading: 0 })
  })

  it('is the only thing that changes when it is installed', () => {
    const overridden = traceScenarios((init) => createKoiMotion(init, { desire: () => ({ heading: 0, gain: 1, kind: 'travel' }) }))
    expect(overridden['cruise']).not.toEqual(GOLDEN_TRACE['cruise'])
  })
})
