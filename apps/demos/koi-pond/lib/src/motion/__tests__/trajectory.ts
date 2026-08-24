/**
 * The scenario driver both the brain's specs and its golden trace run through.
 *
 * Every scenario is a fixed script of stimuli at a fixed frame step, so a run is
 * reproducible to the last float: the same seeds, the same pond, the same
 * `advance` cadence, and the same startles, observations, placements, and depth
 * grants at the same simulated moments.
 */
import type {
  Disturbance,
  KoiFramework,
  KoiOutline,
  KoiPhase,
  KoiProfile,
  NeighborObservation,
  PondEnvironment,
  Vec2,
} from '../../model/types.js'
import { describePond, entryStation } from '../../geometry/virtual-pond.js'
import { koiProfile, koiSeed } from '../../model/traits.js'

/** The frame step every scenario advances by, in seconds. */
const DT = 1 / 60

/** The depth level a koi enters the pond at. */
const ENTRY_DEPTH = 3

/** Everything a brain needs to be born. */
export interface TracedInit {
  /** Everything about the koi that never changes. */
  profile: KoiProfile
  /** The world it swims in. */
  pond: PondEnvironment
  /** Where it enters. */
  position: Vec2
  /** Which way it enters. */
  heading: number
  /** The depth level it enters at. */
  depth: number
}

/** The part of a brain the scenarios drive, structural so any implementation can be traced. */
export interface TracedMotion {
  /**
   * Advances one frame.
   *
   * @param dt - Seconds since the previous frame.
   */
  advance(dt: number): void
  /**
   * Takes the depth level the host granted.
   *
   * @param level - The new level.
   */
  setDepth(level: number): void
  /**
   * Reacts to something striking the water.
   *
   * @param disturbance - Where the water broke and how hard.
   * @returns `true` when this koi startled.
   */
  startle(disturbance: Disturbance): boolean
  /**
   * Takes the relayed view of who is nearby.
   *
   * @param neighbors - The koi close enough to matter.
   */
  observe(neighbors: readonly NeighborObservation[]): void
  /**
   * Carries the koi to a point.
   *
   * @param point - Where its nose is being carried, in pond space.
   */
  place(point: Vec2): void
  /** What the koi is doing right now. */
  readonly state: {
    /** Its nose in pond space. */
    position: Vec2
    /** Its heading in radians. */
    heading: number
    /** Its speed in pixels per second. */
    speed: number
    /** The behavioural state its body reads in. */
    phase: KoiPhase
    /** The depth level the host granted. */
    depth: number
    /** Its nose-to-tail length at its current depth, in CSS pixels. */
    length: number
  }
  /** Whether it is still fleeing. */
  readonly isFleeing: boolean
  /** Whether it has slipped out of the pond and is waiting to return. */
  readonly isAway: boolean
  /**
   * The compact outline the host does its proximity work against.
   *
   * @returns The outline to report.
   */
  outline(): KoiOutline
  /**
   * The depth level this koi would like, or `null` when it is content.
   *
   * @returns The requested level, or `null`.
   */
  takeDepthRequest(): number | null
}

/** Builds a brain for a scenario. */
export type TracedFactory = (init: TracedInit) => TracedMotion

/**
 * One sampled moment, flattened so a whole trajectory stays diffable.
 *
 * The fields are, in order: simulated seconds, nose x, nose y, heading, speed,
 * phase, depth level, body length, a `fleeing`/`away`/`depthRequest` flag
 * string, intent kind, the heading and the gain the koi committed to, intent
 * target x, intent target y, anticipation reach, encounter clearance, the
 * reported spine flattened nose-first, and the half-width at each of those
 * spine samples.
 */
export type TraceSample = readonly [
  t: number,
  x: number,
  y: number,
  heading: number,
  speed: number,
  phase: KoiPhase,
  depth: number,
  length: number,
  flags: string,
  intentKind: string,
  intentHeading: number | null,
  intentGain: number | null,
  targetX: number | null,
  targetY: number | null,
  reachPx: number,
  clearancePx: number,
  spine: readonly number[],
  girth: readonly number[],
]

/** A whole run: the scenario's name and every moment sampled from it. */
export type Trace = Readonly<Record<string, readonly TraceSample[]>>

/**
 * Samples a brain's current moment.
 *
 * @param motion - The brain to read.
 * @param at - The simulated second the sample is taken at.
 * @param request - The depth level the brain asked for on this tick, if any.
 * @returns The flattened sample.
 */
function sample(motion: TracedMotion, at: number, request: number | null): TraceSample {
  const { position, heading, speed, phase, depth, length } = motion.state
  const outline = motion.outline()
  const intent = outline.intent
  const flags = `${motion.isFleeing ? 'F' : '-'}${motion.isAway ? 'A' : '-'}${request === null ? '-' : request}`
  return [
    at,
    position.x,
    position.y,
    heading,
    speed,
    phase,
    depth,
    length,
    flags,
    intent?.kind ?? 'none',
    intent?.heading ?? null,
    intent?.gain ?? null,
    intent?.target?.x ?? null,
    intent?.target?.y ?? null,
    intent?.reachPx ?? 0,
    intent?.clearancePx ?? 0,
    outline.spine.flatMap((point) => [point.x, point.y]),
    [...outline.girth],
  ]
}

/**
 * Reads a koi as its neighbours see it.
 *
 * @param motion - The koi being observed.
 * @param framework - Its framework slug.
 * @param girthRatio - Its build's girth ratio.
 * @returns The observation to relay.
 */
function observationOf(motion: TracedMotion, framework: KoiFramework, girthRatio: number): NeighborObservation {
  const { position, heading, speed, depth, length } = motion.state
  return { framework, x: position.x, y: position.y, heading, speed, depth, length, girth: length * girthRatio }
}

/** A koi's world and opening station, derived exactly as the fish apps derive them. */
interface Station {
  /** Everything about the koi that never changes. */
  profile: KoiProfile
  /** Where it enters. */
  position: Vec2
  /** Which way it enters. */
  heading: number
}

/**
 * Places a koi at its canonical opening station.
 *
 * @param framework - The framework slug rendering it.
 * @param pond - The world it swims in.
 * @returns Its profile and station.
 */
function station(framework: KoiFramework, pond: PondEnvironment): Station {
  const profile = koiProfile(framework)
  const entry = entryStation(pond, koiSeed(framework))
  return { profile, position: entry.position, heading: entry.heading }
}

/**
 * Builds the pond every scenario swims in.
 *
 * @param reducedMotion - Whether the visitor asked for reduced motion.
 * @returns The environment.
 */
function scenarioPond(reducedMotion = false): PondEnvironment {
  return describePond(1920, 1080, 900, 600, reducedMotion)
}

/**
 * Runs one koi alone for a stretch of simulated time, sampling on a fixed beat.
 *
 * @param motion - The brain to drive.
 * @param seconds - How long to run for.
 * @param every - The sampling interval in seconds.
 * @param at - Optional per-frame stimulus, given the simulated second.
 * @param from - The simulated second the run starts at.
 * @returns The samples taken.
 */
function run(
  motion: TracedMotion,
  seconds: number,
  every: number,
  at: (motion: TracedMotion, second: number) => void = () => {},
  from = 0
): TraceSample[] {
  const samples: TraceSample[] = []
  const frames = Math.round(seconds / DT)
  const beat = Math.round(every / DT)
  // why: A request is cleared the frame it is read, so the sample carries the last one asked for since the previous sample rather than the vanishingly rare one that lands on the beat.
  let asked: number | null = null
  for (let frame = 1; frame <= frames; frame += 1) {
    const now = from + frame * DT
    at(motion, now)
    motion.advance(DT)
    asked = motion.takeDepthRequest() ?? asked
    if (frame % beat === 0) {
      samples.push(sample(motion, now, asked))
      asked = null
    }
  }
  return samples
}

/**
 * Drives every scenario through one brain implementation.
 *
 * @param create - Builds a brain from its opening station.
 * @returns Every scenario's sampled trajectory, keyed by scenario name.
 *
 * @example Comparing two implementations
 * ```typescript
 * expect(traceScenarios(createKoiMotion)).toEqual(GOLDEN_TRACE)
 * ```
 */
export function traceScenarios(create: TracedFactory): Trace {
  return {
    cruise: cruise(create),
    turns: turns(create),
    startle: startle(create),
    neighbours: neighbours(create),
    passing: passing(create),
    'reduced-motion': reducedMotion(create),
    boundary: boundary(create),
    carried: carried(create),
    depth: depth(create),
  }
}

/**
 * A long undisturbed cruise: the itinerary, the pace schedule, and the turn
 * cooldowns with nothing else pulling.
 *
 * @param create - Builds a brain from its opening station.
 * @returns The samples taken.
 */
function cruise(create: TracedFactory): readonly TraceSample[] {
  const pond = scenarioPond()
  const { profile, position, heading } = station('react', pond)
  return run(create({ profile, pond, position, heading, depth: ENTRY_DEPTH }), 90, 3)
}

/**
 * The same cruise on a different seed, so a second itinerary and a second set
 * of cooldown draws are covered.
 *
 * @param create - Builds a brain from its opening station.
 * @returns The samples taken.
 */
function turns(create: TracedFactory): readonly TraceSample[] {
  const pond = scenarioPond()
  const { profile, position, heading } = station('vue', pond)
  return run(create({ profile, pond, position, heading, depth: ENTRY_DEPTH }), 90, 3)
}

/**
 * A strike beside the koi, its bolt, and the long settle back to cruise.
 *
 * @param create - Builds a brain from its opening station.
 * @returns The samples taken.
 */
function startle(create: TracedFactory): readonly TraceSample[] {
  const pond = scenarioPond()
  const { profile, position, heading } = station('react', pond)
  const motion = create({ profile, pond, position, heading, depth: ENTRY_DEPTH })
  const strike: Disturbance = { x: position.x + pond.fishLength, y: position.y - pond.fishLength, intensity: 1 }
  let struck = false
  return run(motion, 24, 1, (koi, second) => {
    if (!struck && second >= 3) {
      struck = true
      koi.startle(strike)
    }
  })
}

/**
 * Two koi on crossing courses, each relayed the other every frame: give-way,
 * evasion arcs, pace scaling, and depth requests.
 *
 * @param create - Builds a brain from its opening station.
 * @returns The samples taken, from the first koi.
 */
function neighbours(create: TracedFactory): readonly TraceSample[] {
  const pond = scenarioPond()
  const first = station('react', pond)
  const second = station('solid', pond)
  // why: Both koi are set on the same point from opposite sides, so the pair actually has to resolve a crossing rather than drifting past each other.
  const centre = { x: pond.width / 2, y: pond.height / 2 }
  const reach = pond.fishLength * 1.4
  const one = create({
    profile: first.profile,
    pond,
    position: { x: centre.x - reach, y: centre.y - pond.fishLength * 0.2 },
    heading: 0,
    depth: ENTRY_DEPTH,
  })
  const two = create({
    profile: second.profile,
    pond,
    position: { x: centre.x + reach, y: centre.y + pond.fishLength * 0.2 },
    heading: Math.PI,
    depth: ENTRY_DEPTH,
  })
  const samples: TraceSample[] = []
  const frames = Math.round(40 / DT)
  const beat = Math.round(2 / DT)
  let asked: number | null = null
  for (let frame = 1; frame <= frames; frame += 1) {
    one.observe([observationOf(two, 'solid', second.profile.build.girthRatio)])
    two.observe([observationOf(one, 'react', first.profile.build.girthRatio)])
    one.advance(DT)
    two.advance(DT)
    asked = one.takeDepthRequest() ?? asked
    two.takeDepthRequest()
    if (frame % beat === 0) {
      samples.push(sample(one, frame * DT, asked))
      asked = null
    }
  }
  return samples
}

/**
 * Two koi willing to change depth, closing head-on with a host that grants
 * every level they ask for: the depth pass, the roll it starts, and the
 * vertical intent the pass reports.
 *
 * @param create - Builds a brain from its opening station.
 * @returns The samples taken, from the koi that gives way.
 */
function passing(create: TracedFactory): readonly TraceSample[] {
  const pond = scenarioPond()
  const first = station('lit', pond)
  const second = station('svelte', pond)
  const centre = { x: pond.width / 2, y: pond.height / 2 }
  const reach = pond.fishLength * 1.4
  const one = create({ profile: first.profile, pond, position: { x: centre.x - reach, y: centre.y }, heading: 0, depth: ENTRY_DEPTH })
  const two = create({
    profile: second.profile,
    pond,
    position: { x: centre.x + reach, y: centre.y },
    heading: Math.PI,
    depth: ENTRY_DEPTH,
  })
  const samples: TraceSample[] = []
  const frames = Math.round(30 / DT)
  const beat = Math.round(0.5 / DT)
  let asked: number | null = null
  for (let frame = 1; frame <= frames; frame += 1) {
    one.observe([observationOf(two, 'svelte', second.profile.build.girthRatio)])
    two.observe([observationOf(one, 'lit', first.profile.build.girthRatio)])
    one.advance(DT)
    two.advance(DT)
    // why: The host grants every level asked for, so the pass actually completes and the roll that follows it is part of the trace.
    const request = one.takeDepthRequest()
    if (request !== null) {
      one.setDepth(request)
      asked = request
    }
    const other = two.takeDepthRequest()
    if (other !== null) {
      two.setDepth(other)
    }
    if (frame % beat === 0) {
      samples.push(sample(one, frame * DT, asked))
      asked = null
    }
  }
  return samples
}

/**
 * A cruise on a pond whose visitor asked for reduced motion.
 *
 * @param create - Builds a brain from its opening station.
 * @returns The samples taken.
 */
function reducedMotion(create: TracedFactory): readonly TraceSample[] {
  const pond = scenarioPond(true)
  const { profile, position, heading } = station('svelte', pond)
  const motion = create({ profile, pond, position, heading, depth: ENTRY_DEPTH })
  const strike: Disturbance = { x: position.x, y: position.y, intensity: 1 }
  let struck = false
  return run(motion, 30, 2, (koi, second) => {
    if (!struck && second >= 5) {
      struck = true
      koi.startle(strike)
    }
  })
}

/**
 * A koi aimed straight out of the pond: the boundary correction, the slip out,
 * the absence, and the toroidal return.
 *
 * @param create - Builds a brain from its opening station.
 * @returns The samples taken.
 */
function boundary(create: TracedFactory): readonly TraceSample[] {
  const pond = scenarioPond()
  const { profile } = station('angular', pond)
  const motion = create({
    profile,
    pond,
    position: { x: pond.fishLength * 1.5, y: pond.height / 2 },
    heading: Math.PI,
    depth: ENTRY_DEPTH,
  })
  return run(motion, 120, 4)
}

/**
 * A koi grabbed, dragged along a path, and released: the lean, the dropped
 * intentions, and the calm cruise it resumes.
 *
 * @param create - Builds a brain from its opening station.
 * @returns The samples taken.
 */
function carried(create: TracedFactory): readonly TraceSample[] {
  const pond = scenarioPond()
  const { profile, position, heading } = station('preact', pond)
  const motion = create({ profile, pond, position, heading, depth: ENTRY_DEPTH })
  const before = run(motion, 5, 1)
  const drag: TraceSample[] = []
  const from = motion.state.position
  for (let step = 1; step <= 60; step += 1) {
    motion.place({ x: from.x + step * 3, y: from.y + step * 2 })
    motion.advance(DT)
    const request = motion.takeDepthRequest()
    if (step % 20 === 0) {
      drag.push(sample(motion, 5 + step * DT, request))
    }
  }

  return [...before, ...drag, ...run(motion, 15, 1, () => {}, 6)]
}

/**
 * Depth grants and the roll each one starts.
 *
 * @param create - Builds a brain from its opening station.
 * @returns The samples taken.
 */
function depth(create: TracedFactory): readonly TraceSample[] {
  const pond = scenarioPond()
  const { profile, position, heading } = station('lit', pond)
  const motion = create({ profile, pond, position, heading, depth: ENTRY_DEPTH })
  const grants = new Map([
    [4, 1],
    [9, 5],
    [14, 3],
  ])
  return run(motion, 20, 1, (koi, second) => {
    const level = grants.get(Math.round(second * 60) / 60)
    if (level !== undefined) {
      koi.setDepth(level)
    }
  })
}
