/**
 * This koi's swimming brain.
 *
 * Framework-free on purpose: it is driven by a plain `advance(dt)` and holds no
 * DOM and no hooks, so it can be unit-tested frame by frame and so the React
 * components next door are genuinely the only browser-facing part of this app.
 *
 * It composes the shared steering verbs into *this* fish's judgement. The other
 * six koi compose the same verbs differently — that independence is the whole
 * point of the pond, so nothing in here belongs in the shared lib.
 *
 * Every frame resolves one desired heading from four competing pulls, in strict
 * priority: get away from what struck the water, do not leave the pond, do not
 * hit anyone, and otherwise drift. Only the winning pull steers, which is what
 * keeps the motion legible instead of averaging into mush.
 */
import type {
  Disturbance,
  KoiOutline,
  KoiPhase,
  KoiProfile,
  NeighborObservation,
  PondEnvironment,
  SpineState,
  Vec2,
} from '@hyperfrontend/demo-koi-lib'
import {
  advanceSpine,
  boundaryPressure,
  createSpine,
  depthScale,
  givesWay,
  headingAwayFrom,
  resolveEncounter,
  sampleSpine,
  spineGirth,
  turnToward,
  wanderOffset,
} from '@hyperfrontend/demo-koi-lib'

/** How many spine samples travel in a reported outline. */
const OUTLINE_SAMPLES = 5

/** Cruise speed band in body lengths per second, from the slowest koi to the briskest. */
const CRUISE_BL_S = { min: 0.26, max: 0.62 }

/** Escape speed band in body lengths per second. */
const ESCAPE_BL_S = { min: 2.1, max: 4.3 }

/** Turn rate band in radians per second at a relaxed cruise. */
const TURN_RATE = { min: 0.5, max: 1.25 }

/** How much faster a fleeing koi can turn than a cruising one. */
const ESCAPE_TURN_GAIN = 2.4

/** Escape duration band in seconds. */
const ESCAPE_S = { min: 1.1, max: 2.9 }

/** How sharply a koi must be turning to read as `turning` rather than `relaxed`, in radians per second. */
const TURNING_THRESHOLD = 0.42

/** How quickly speed eases toward its target, as a fraction closed per second. */
const SPEED_EASE = 3.2

/** How far a koi notices things, in body lengths, at the extremes of its awareness trait. */
const AWARENESS_BL = { min: 2.2, max: 5.4 }

/** How much reduced motion damps wandering and escape intensity. */
const REDUCED_MOTION_DAMPING = 0.45

/** How long a koi reads as rolling between two depth levels, in seconds. */
const DEPTH_ROLL_S = 1.4

/** How urgently the boundary must pull before it outranks every other steering pull. */
const BOUNDARY_URGENCY = 0.08

/** Widest course change a single crossing may ask for, in radians. */
const EVASION_TURN = Math.PI / 3

/**
 * Maps a normalised trait onto a band.
 *
 * @param trait - The trait, 0 to 1.
 * @param band - The band to map onto.
 * @returns The mapped value.
 */
function lerp(trait: number, band: { min: number; max: number }): number {
  return band.min + trait * (band.max - band.min)
}

/** What the koi is doing right now. */
export interface KoiState {
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
  /** Its centreline. */
  spine: SpineState
}

/** How this koi starts its life in the pond. */
export interface KoiMotionOptions {
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

/** The koi's brain. */
export interface KoiMotion {
  /**
   * Advances one frame.
   *
   * @param dt - Seconds since the previous frame.
   * @param elapsedS - Seconds since the pond opened.
   */
  advance(dt: number, elapsedS: number): void
  /**
   * Adopts a resized pond.
   *
   * @param pond - The newly announced world.
   */
  setPond(pond: PondEnvironment): void
  /**
   * Takes the depth level the host granted.
   *
   * @param level - The new level.
   */
  setDepth(level: number): void
  /**
   * Reacts to something striking the water.
   *
   * Whether the koi actually bolts is its own business: a shy fish flees a
   * distant splash, a bold one ignores one that landed beside it.
   *
   * @param disturbance - Where the water broke and how hard.
   * @returns `true` when this koi startled.
   */
  startle(disturbance: Disturbance): boolean
  /**
   * Takes the host's relayed view of who is nearby.
   *
   * @param neighbors - The koi close enough to matter.
   */
  observe(neighbors: readonly NeighborObservation[]): void
  /** What the koi is doing right now. */
  readonly state: KoiState
  /** Whether it is still fleeing. */
  readonly isFleeing: boolean
  /**
   * The compact outline the host does its proximity work against.
   *
   * @returns The outline to report.
   */
  outline(): KoiOutline
  /**
   * The depth level this koi would like, or `null` when it is content.
   *
   * Cleared once read, so a request is made once rather than every frame.
   *
   * @returns The requested level, or `null`.
   */
  takeDepthRequest(): number | null
}

/**
 * Creates this koi's swimming brain.
 *
 * @param options - Its profile, the pond, and where it enters.
 * @returns The brain.
 *
 * @example Swimming a koi
 * ```typescript
 * const motion = createKoiMotion({ profile, pond, position, heading, depth })
 * motion.advance(dt, elapsedS)
 * feature.send('outline', motion.outline())
 * ```
 */
export function createKoiMotion(options: KoiMotionOptions): KoiMotion {
  const { profile } = options
  const { traits, build } = profile

  let pond = options.pond
  let position = { ...options.position }
  let heading = options.heading
  let depth = options.depth
  let phase: KoiPhase = 'relaxed'
  let neighbors: readonly NeighborObservation[] = []
  let fleeingUntilS = 0
  let elapsed = 0
  let threat: Vec2 | null = null
  let depthRequest: number | null = null
  let transitioningUntilS = 0

  const bodyLength = (): number => pond.fishLength * build.lengthScale * depthScale(depth)
  let speed = pond.fishLength * lerp(traits.cruiseSpeed, CRUISE_BL_S)
  let spine = createSpine(position, heading, bodyLength())

  /**
   * Reads how this koi would settle a crossing with one neighbour.
   *
   * @param neighbor - The koi it is closing with.
   * @returns The steering verb, its urgency, and any depth it would rather take.
   */
  const encounterWith = (neighbor: NeighborObservation) =>
    resolveEncounter(
      { position, heading, speed, depth, length: bodyLength(), traits },
      neighbor,
      givesWay(profile.framework, neighbor.framework)
    )

  /**
   * The heading this koi wants, and how hard it is committed to it.
   *
   * @returns The desired heading and the turn gain to reach it with.
   */
  const desire = (): { heading: number; gain: number } => {
    if (threat !== null && elapsed < fleeingUntilS) {
      return { heading: headingAwayFrom(position, threat, heading), gain: ESCAPE_TURN_GAIN }
    }

    const edge = boundaryPressure(pond, position, heading)
    // why: The boundary is the one pull that can override a crossing — a koi that dodges a neighbour into open air has left the pond.
    if (edge.urgency > BOUNDARY_URGENCY) {
      const caution = 0.4 + traits.directionalCaution * 0.6
      return { heading: Math.atan2(edge.inward.y, edge.inward.x), gain: 1 + edge.urgency * caution * 2 }
    }

    for (const neighbor of neighbors) {
      const resolution = encounterWith(neighbor)
      if (resolution.action === 'hold') {
        continue
      }
      if (resolution.depth !== null) {
        depthRequest = resolution.depth
        continue
      }
      if (resolution.action === 'turn') {
        return { heading: heading + resolution.turn * EVASION_TURN, gain: 1 + resolution.urgency }
      }
      // note: `slow` and `accelerate` settle an overtaking without a course change, so the koi keeps steering on whatever comes next.
    }

    const damping = pond.reducedMotion ? REDUCED_MOTION_DAMPING : 1
    const drift = wanderOffset(profile.traits.awareness * 1000, elapsed) * 0.55 * damping
    return { heading: heading + drift, gain: 0.35 }
  }

  /**
   * The speed this koi is aiming for right now, in pixels per second.
   *
   * @returns The target speed.
   */
  const targetSpeed = (): number => {
    if (elapsed < fleeingUntilS) {
      const damping = pond.reducedMotion ? REDUCED_MOTION_DAMPING : 1
      return pond.fishLength * lerp(traits.reactionIntensity, ESCAPE_BL_S) * damping
    }
    let cruise = pond.fishLength * lerp(traits.cruiseSpeed, CRUISE_BL_S)
    for (const neighbor of neighbors) {
      const resolution = encounterWith(neighbor)
      if (resolution.action === 'slow') {
        cruise *= 1 - 0.45 * resolution.urgency
      } else if (resolution.action === 'accelerate') {
        cruise *= 1 + 0.5 * resolution.urgency
      }
    }
    return cruise
  }

  return {
    advance(dt, elapsedS) {
      elapsed = elapsedS
      const previousHeading = heading
      const wanted = desire()
      const turnRate = lerp(traits.turnResponsiveness, TURN_RATE) * wanted.gain
      heading = turnToward(heading, wanted.heading, turnRate * dt)

      const target = targetSpeed()
      speed += (target - speed) * Math.min(1, SPEED_EASE * dt)
      position = { x: position.x + Math.cos(heading) * speed * dt, y: position.y + Math.sin(heading) * speed * dt }

      const turnedBy = Math.abs(turnToward(0, heading - previousHeading, Math.PI)) / Math.max(dt, 1e-6)
      if (elapsed < transitioningUntilS) {
        phase = 'depth-transition'
      } else if (elapsed < fleeingUntilS) {
        phase = 'escape'
      } else if (turnedBy > TURNING_THRESHOLD) {
        phase = 'turning'
      } else {
        phase = 'relaxed'
      }

      spine = advanceSpine(spine, {
        nose: position,
        length: bodyLength(),
        speed,
        phase,
        dt,
        reducedMotion: pond.reducedMotion,
      })
    },

    setPond(next) {
      pond = next
    },

    setDepth(level) {
      if (level === depth) {
        return
      }
      depth = level
      depthRequest = null
      // why: The roll between levels is a visible state of its own, so the body reads as changing depth rather than merely resizing.
      transitioningUntilS = elapsed + DEPTH_ROLL_S
    },

    startle(disturbance) {
      const reach = pond.fishLength * lerp(traits.awareness, AWARENESS_BL)
      const distance = Math.hypot(position.x - disturbance.x, position.y - disturbance.y)
      if (distance > reach) {
        return false
      }
      // how: What the koi feels is the strike damped by how far off it landed; whether that beats its nerve is what the shyness trait decides.
      const felt = disturbance.intensity * (1 - distance / reach)
      if (felt < 0.5 - traits.shyness * 0.45) {
        return false
      }
      threat = { x: disturbance.x, y: disturbance.y }
      fleeingUntilS = elapsed + lerp(traits.reactionIntensity, ESCAPE_S) * (0.6 + felt * 0.6)
      return true
    },

    observe(next) {
      neighbors = next
    },

    get state() {
      return { position, heading, speed, phase, depth, length: bodyLength(), spine }
    },

    get isFleeing() {
      return elapsed < fleeingUntilS
    },

    outline() {
      return {
        framework: profile.framework,
        spine: sampleSpine(spine.joints, OUTLINE_SAMPLES),
        girth: sampleSpine(spineGirth(bodyLength(), build.girthRatio), OUTLINE_SAMPLES),
        heading,
        speed,
        depth,
        phase,
      }
    },

    takeDepthRequest() {
      const requested = depthRequest
      depthRequest = null
      return requested
    },
  }
}
