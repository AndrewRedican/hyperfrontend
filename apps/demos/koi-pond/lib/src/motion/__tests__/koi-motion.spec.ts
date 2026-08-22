import { describe, expect, it } from 'vitest'
import type { Disturbance, KoiFramework, NeighborObservation, PondEnvironment } from '../../model/types.js'
import { describePond, entryStation } from '../../geometry/virtual-pond.js'
import { wrapAngle } from '../../geometry/steering.js'
import { KOI_FRAMEWORKS } from '../../model/types.js'
import { koiProfile, koiSeed } from '../../model/traits.js'
import type { KoiTurnTierName } from '../manoeuvre.js'
import type { KoiDecision, KoiMotion, KoiMotionInit, KoiMotionOptions } from '../koi-motion.js'
import { DEFAULT_MOTION_LIMITS, DEFAULT_MOTION_TRIM, createKoiMotion } from '../koi-motion.js'
import { GOLDEN_TRACE } from './golden-trace.js'
import { traceScenarios } from './trajectory.js'

/** The frame step every check advances by, in seconds. */
const DT = 1 / 60

/** The depth level a koi enters the pond at. */
const ENTRY_DEPTH = 3

/** How far either side of the pond's centre a mirrored pair is set, in CSS pixels. */
const HEAD_ON_GAP = 250

/** How far ahead of a koi's nose a check parks another koi, in CSS pixels. */
const OBSTACLE_AHEAD = 200

/** How far to one side of that a check parks it when the water has to read lopsided, in CSS pixels. */
const OBSTACLE_ASIDE = 280

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
function born(framework: KoiFramework, world: PondEnvironment): KoiMotionInit {
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
  it('swims every scenario along the trajectory its seeds spell out', () => {
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

  it('reports the turn rate the heading actually moved at', () => {
    const motion = createKoiMotion(born('react', pond()))
    swim(motion, 12)
    for (let frame = 0; frame < 240; frame += 1) {
      const before = motion.state.heading
      motion.advance(DT)
      const { heading, turnVelocity } = motion.state
      expect(wrapAngle(heading - before)).toBeCloseTo(turnVelocity * DT, 12)
    }
  })

  it('unwinds the turn rate when a visitor takes hold', () => {
    const world = pond()
    const motion = createKoiMotion(born('react', world))
    swim(motion, 12)
    motion.place({ x: world.width / 2, y: world.height / 2 })
    expect(motion.state.turnVelocity).toBe(0)
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
    expect(flee).toEqual({
      atS: expect.any(Number),
      cause: 'flee',
      kind: 'avoid',
      heading: expect.any(Number),
      gain: 1.7,
      depth: null,
      tier: null,
    })
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
      tier: null,
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
    expect(new Set(seen)).toEqual(new Set(['glide', 'turn', 'boundary']))
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

/**
 * Reads a koi as its neighbours see it.
 *
 * @param motion - The koi being observed.
 * @param framework - Its framework slug.
 * @param still - Whether to report it as holding station rather than swimming.
 * @returns The observation to relay.
 */
function observationOf(motion: KoiMotion, framework: KoiFramework, still = false): NeighborObservation {
  const { position, heading, speed, depth, length } = motion.state
  return {
    framework,
    x: position.x,
    y: position.y,
    heading,
    speed: still ? 0 : speed,
    depth,
    length,
    girth: length * koiProfile(framework).build.girthRatio,
  }
}

/** What a mirrored head-on pair did about each other. */
interface HeadOn {
  /** Whether the koi heading east broke toward its right flank and held that side. */
  oneBrokeRight: boolean
  /** Whether the koi heading west did the same. */
  twoBrokeRight: boolean
  /** Whether they passed without ever coming within touching distance. */
  cleared: boolean
  /** Every decision either of them committed to, in order. */
  decisions: KoiDecision[]
}

/**
 * Runs two koi at each other on exactly mirrored courses.
 *
 * The pair is set close enough that the crossing is live on the first decision,
 * so neither has taken a leg of its own itinerary first and the water each of
 * them reads is exactly as even as the other's.
 *
 * @param options - How both koi's judgement differs from the shared default.
 * @returns What the pair did.
 */
function headOn(options: KoiMotionOptions = {}): HeadOn {
  const world = pond()
  const centre = { x: world.width / 2, y: world.height / 2 }
  const decisions: KoiDecision[] = []
  const watched: KoiMotionOptions = { ...options, onDecision: (decision) => decisions.push(decision) }
  const one = createKoiMotion({ ...born('react', world), position: { x: centre.x - HEAD_ON_GAP, y: centre.y }, heading: 0 }, watched)
  const two = createKoiMotion(
    { ...born('angular', world), position: { x: centre.x + HEAD_ON_GAP, y: centre.y }, heading: Math.PI },
    watched
  )
  let separation = Infinity
  let oneLeast = Infinity
  let twoLeast = Infinity
  for (let frame = 1; frame <= Math.round(3.5 / DT); frame += 1) {
    one.observe([observationOf(two, 'angular')])
    two.observe([observationOf(one, 'react')])
    one.advance(DT)
    two.advance(DT)
    separation = Math.min(separation, Math.hypot(one.state.position.x - two.state.position.x, one.state.position.y - two.state.position.y))
    oneLeast = Math.min(oneLeast, one.state.turnVelocity)
    twoLeast = Math.min(twoLeast, two.state.turnVelocity)
  }
  const bodies = one.state.length * koiProfile('react').build.girthRatio + two.state.length * koiProfile('angular').build.girthRatio
  return { oneBrokeRight: oneLeast > 0, twoBrokeRight: twoLeast > 0, cleared: separation > bodies, decisions }
}

/**
 * The tier a koi commits when a koi holding station sits ahead of it.
 *
 * @param ahead - How far ahead of its nose the other koi sits, in pixels.
 * @param aside - How far to its right the other koi sits, in pixels.
 * @returns The tier it committed, or `null` when it saw nothing to avoid.
 */
function tierAgainst(ahead: number, aside: number): KoiTurnTierName | null {
  return againstAStillKoi(ahead, aside, 1).decisions.find((decision) => decision.cause === 'evade')?.tier ?? null
}

/**
 * Which flank a koi breaks toward with one koi holding station off its bow.
 *
 * @param aside - How far to its right the other koi sits; negative places it to the left.
 * @returns `1` when it broke toward its right flank, `-1` toward its left.
 */
function flankAgainst(aside: number): number {
  return Math.sign(againstAStillKoi(OBSTACLE_AHEAD, aside, 30).turnVelocity)
}

/**
 * Runs a koi at a koi holding station a given way ahead of it and aside.
 *
 * @param ahead - How far ahead of its nose the other koi sits, in pixels.
 * @param aside - How far to its right the other koi sits, in pixels.
 * @param frames - How many frames to run for.
 * @returns Everything it committed to, and the turn rate it ended on.
 */
function againstAStillKoi(ahead: number, aside: number, frames: number): { decisions: KoiDecision[]; turnVelocity: number } {
  const world = pond()
  const centre = { x: world.width / 2, y: world.height / 2 }
  const decisions: KoiDecision[] = []
  const motion = createKoiMotion(
    { ...born('react', world), position: { ...centre }, heading: 0 },
    { onDecision: (decision) => decisions.push(decision) }
  )
  const still = createKoiMotion({
    ...born('angular', world),
    position: { x: centre.x + ahead, y: centre.y + aside },
    heading: Math.PI / 2,
  })
  const seen = observationOf(still, 'angular', true)
  swim(motion, frames * DT, () => motion.observe([seen]))
  return { decisions, turnVelocity: motion.state.turnVelocity }
}

/**
 * The speed a koi settles at while it holds a fully committed turn.
 *
 * @param turnBrake - How much of its pace a fully committed turn costs it.
 * @returns Its settled speed in pixels per second.
 */
function corneringSpeed(turnBrake: number): number {
  const world = pond()
  const motion = createKoiMotion(
    { ...born('react', world), position: { x: world.width / 2, y: world.height / 2 }, heading: 0 },
    {
      trim: { turnBrake },
      // why: A target that stays a fixed angle off the nose never arrives, so the koi holds its whole helm on and the reading is the brake alone rather than a turn ramping out.
      desire: (_desire, context) => ({ heading: context.heading + 1.4, gain: DEFAULT_MOTION_TRIM.evasionTiers.hard.gain, kind: 'avoid' }),
    }
  )
  swim(motion, 12)
  return motion.state.speed
}

/**
 * The hardest any koi turned across a fuzz of encounters, measured against the
 * hardest its own trait and gain would allow with no cap applied.
 *
 * Every koi in the shoal swims a long leg with a neighbour permanently across
 * its bow and a strike landing beside it every few seconds, so escapes,
 * boundary corrections, and avoidance arcs all reach their ceilings.
 *
 * @returns The largest share of an uncapped ceiling any of them commanded, rounded to nine places because a share that saturates lands a few ulps either side of the cap it is measuring.
 */
function peakTurnShare(): number {
  let worst = 0
  for (const framework of KOI_FRAMEWORKS) {
    const world = pond()
    const { traits, build } = koiProfile(framework)
    let uncapped = 0
    let turned = 0
    const motion = createKoiMotion(born(framework, world), {
      desire: (desire, context) => {
        const overCruise = Math.max(0, context.speed / world.fishLength - DEFAULT_MOTION_TRIM.cruiseBlS.max)
        const rate = DEFAULT_MOTION_TRIM.turnRate
        const ceiling =
          ((rate.min + traits.turnResponsiveness * (rate.max - rate.min)) * desire.gain) /
          (1 + overCruise * DEFAULT_MOTION_LIMITS.turnSpeedTax)
        uncapped = Math.max(uncapped, ceiling)
        return desire
      },
    })
    swim(motion, 40, (second) => {
      if (Math.abs((second % 7) - DT) < DT / 2) {
        motion.startle({ x: motion.state.position.x + 20, y: motion.state.position.y - 20, intensity: 1 })
      }
      const { position, heading, speed, depth, length } = motion.state
      motion.observe([
        {
          framework: 'vue',
          x: position.x + Math.cos(heading) * world.fishLength * 1.2,
          y: position.y + Math.sin(heading) * world.fishLength * 1.2,
          heading: heading + Math.PI / 2,
          speed: speed * 0.8,
          depth,
          length,
          girth: length * build.girthRatio,
        },
      ])
      turned = Math.max(turned, Math.abs(motion.state.turnVelocity))
    })
    worst = Math.max(worst, turned / uncapped)
  }
  return Math.round(worst * 1e9) / 1e9
}

describe('createKoiMotion manoeuvre tiers', () => {
  it('commits the least effort a crossing needs, within what its nearness permits', () => {
    expect({
      distant: tierAgainst(300, 0),
      close: tierAgainst(90, 0),
      lean: tierAgainst(OBSTACLE_AHEAD, OBSTACLE_ASIDE),
      full: tierAgainst(OBSTACLE_AHEAD, 0),
    }).toEqual({
      distant: 'subtle',
      close: 'hard',
      lean: 'subtle',
      full: 'normal',
    })
  })
})

describe('createKoiMotion avoidance side', () => {
  it('breaks a mirrored pair to the right, so both koi clear each other', () => {
    const { oneBrokeRight, twoBrokeRight, cleared } = headOn()
    expect({ oneBrokeRight, twoBrokeRight, cleared }).toEqual({ oneBrokeRight: true, twoBrokeRight: true, cleared: true })
  })

  it('turns toward the clearer flank when the water is lopsided', () => {
    expect({ crowdedRight: flankAgainst(OBSTACLE_ASIDE), crowdedLeft: flankAgainst(-OBSTACLE_ASIDE) }).toEqual({
      crowdedRight: -1,
      crowdedLeft: 1,
    })
  })

  it('reaches the same decisions, bias included, on the same seeds', () => {
    expect(headOn().decisions).toEqual(headOn().decisions)
  })
})

describe('createKoiMotion manoeuvre cost', () => {
  it('brakes into a turn it has committed its whole helm to', () => {
    expect(corneringSpeed(DEFAULT_MOTION_TRIM.turnBrake) / corneringSpeed(0)).toBeLessThan(0.9)
  })

  it('never winds a turn past four fifths of the ceiling its gain asks for', () => {
    expect(peakTurnShare()).toBeLessThanOrEqual(0.8)
  })
})
