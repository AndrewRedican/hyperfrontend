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
 * Motion is event-shaped rather than noise-shaped. The koi swims legs of a
 * seeded itinerary at a seeded pace; a change of course is a discrete turn that
 * begins, runs its bounded arc, ends, and is followed by a cooldown before the
 * next ordinary turn may start. Heavier pulls interrupt in strict priority —
 * flee what struck the water, come back to the pond, settle a crossing — and
 * each decision is anchored when it is made, never re-derived against the
 * koi's own moving heading, which is what kept the old brain circling.
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
  SHORE_ABSENT_S,
  advanceSpine,
  boundaryPressure,
  createEncounterMemory,
  createItinerary,
  createPaceSchedule,
  createSpine,
  depthScale,
  givesWay,
  headingAwayFrom,
  headingTo,
  koiSeed,
  pondBounds,
  pondCentre,
  sampleSpine,
  slipsAway,
  spineGirth,
  turnToward,
  wanderOffset,
  wrapAcross,
  wrapAngle,
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

/** The measured turn rate that reads as `turning`, and the softer rate that releases it. */
const TURNING_ENTER = 0.42
const TURNING_EXIT = 0.3

/** How quickly speed eases toward its target, as a fraction closed per second. */
const SPEED_EASE = 3.2

/** How far a koi notices things, in body lengths, at the extremes of its awareness trait. */
const AWARENESS_BL = { min: 2.2, max: 5.4 }

/** How much reduced motion damps wandering and escape intensity. */
const REDUCED_MOTION_DAMPING = 0.45

/** How long a koi reads as rolling between two depth levels, in seconds. */
const DEPTH_ROLL_S = 1.4

/** How often the koi re-forms its judgement about neighbours and its itinerary, in seconds. */
const DECISION_INTERVAL_S = 0.1

/** The bearing error that schedules an ordinary turn rather than a drift, in radians. */
const TURN_TRIGGER = 0.35

/** Longest an ordinary turn may run, in seconds. */
const TURN_MAX_S = 2.4

/** The cooldown band after an ordinary turn, in seconds, drawn from the koi's seed. */
const TURN_COOLDOWN_S = { min: 2.5, max: 6 }

/** How firmly the koi corrects its course between turns — a drift, not a manoeuvre. */
const GLIDE_GAIN = 0.12

/** How much ambient waviness rides on a straight leg, in radians. */
const WANDER_RIPPLE = 0.12

/** The boundary urgency that engages a correction, and the softer one that releases it. */
const BOUNDARY_ENGAGE = 0.12
const BOUNDARY_RELEASE = 0.05

/** The evasion arc band an encounter asks for, graded by urgency, in radians. */
const EVASION_TURN = { min: Math.PI / 8, max: Math.PI / 3 }

/** How far past the hard boundary a slipping koi swims before its absence starts, in body lengths. */
const EXIT_CLEARANCE_BL = 0.6

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

/** Where this koi stands with the shoreline. */
type ShoreState = 'in' | 'leaving' | 'away' | 'returning'

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
   * The brain keeps its own clock by accumulating `dt`, so a stalled tab
   * resumes mid-behaviour instead of fast-forwarding through expired events.
   *
   * @param dt - Seconds since the previous frame.
   */
  advance(dt: number): void
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
 * motion.advance(dt)
 * feature.send('outline', motion.outline())
 * ```
 */
export function createKoiMotion(options: KoiMotionOptions): KoiMotion {
  const { profile } = options
  const { traits, build } = profile
  const seed = koiSeed(profile.framework)

  let pond = options.pond
  let position = { ...options.position }
  let heading = options.heading
  let depth = options.depth
  let phase: KoiPhase = 'relaxed'
  let neighbors: readonly NeighborObservation[] = []
  let elapsed = 0
  let fleeingUntilS = 0
  let threat: Vec2 | null = null
  let depthRequest: number | null = null
  let transitioningUntilS = 0

  let shore: ShoreState = 'in'
  let crossings = 0
  let awayUntilS = 0
  let boundaryEngaged = false

  let lastDecisionS = -DECISION_INTERVAL_S
  let course = options.heading
  let evasionHeading: number | null = null
  let evasionUrgency = 0
  let paceScale = 1
  let turnUntilS = 0
  let cooldownUntilS = 0
  let turnDraws = 0

  const bodyLength = (): number => pond.fishLength * build.lengthScale * depthScale(depth)
  const bodyGirth = (): number => bodyLength() * build.girthRatio
  let speed = pond.fishLength * lerp(traits.cruiseSpeed, CRUISE_BL_S)
  let spine = createSpine(position, heading, bodyLength())
  const encounters = createEncounterMemory()
  const pace = createPaceSchedule(seed)
  const itinerary = createItinerary(seed)

  /**
   * Reads this koi as the encounter resolver sees it, right now.
   *
   * @returns Its position, course, and body.
   */
  const encounterSelf = () => ({
    position,
    heading,
    speed,
    depth,
    length: bodyLength(),
    girth: bodyGirth(),
    traits,
  })

  /**
   * Re-forms the koi's judgement: the itinerary leg, the pace, and how every
   * nearby crossing is settled.
   *
   * Runs at its own low cadence rather than every frame, and anchors any
   * evasion as an absolute heading — a target that chased the koi's own moving
   * heading is what used to walk the shoal into circles.
   */
  const decide = (): void => {
    lastDecisionS = elapsed
    paceScale = 1
    evasionHeading = null
    evasionUrgency = 0

    const self = encounterSelf()
    for (const neighbor of neighbors) {
      const resolution = encounters.resolve(self, neighbor, givesWay(profile.framework, neighbor.framework), elapsed)
      if (resolution.action === 'hold') {
        continue
      }
      if (resolution.depth !== null) {
        depthRequest = resolution.depth
        continue
      }
      if (resolution.action === 'slow') {
        paceScale = Math.max(0.4, paceScale * (1 - 0.45 * resolution.urgency))
      } else if (resolution.action === 'accelerate') {
        paceScale = Math.min(1.7, paceScale * (1 + 0.5 * resolution.urgency))
      } else if (resolution.urgency >= evasionUrgency) {
        // why: The arc follows the urgency, so a grazing encounter asks for a lean while only a genuine collision course asks for the full break.
        evasionUrgency = resolution.urgency
        evasionHeading = heading + resolution.turn * lerp(resolution.urgency, EVASION_TURN)
      }
    }

    if (shore === 'in') {
      course = headingTo(position, itinerary.current(pond, position, elapsed).point)
    }
  }

  /**
   * The heading this koi wants, and how hard it is committed to it.
   *
   * @returns The desired heading and the turn gain to reach it with.
   */
  const desire = (): { heading: number; gain: number } => {
    if (threat !== null && elapsed < fleeingUntilS) {
      return { heading: headingAwayFrom(position, threat, heading), gain: ESCAPE_TURN_GAIN }
    }

    // why: A koi that chose to slip out holds its course — the whole point of the slip is that the correction was ignored.
    if (shore === 'leaving' || shore === 'away') {
      return { heading, gain: GLIDE_GAIN }
    }

    if (shore === 'returning') {
      // why: The itinerary's course predates the absence; until the koi is back inside, the only sensible pull is open water.
      return { heading: headingTo(position, pondCentre(pond)), gain: 0.5 }
    }

    const edge = boundaryPressure(pond, position, heading)
    // why: Engage and release at different urgencies — a single threshold flickers the correction on and off at the margin, and that flicker is the left-right-left vibration.
    if (!boundaryEngaged && edge.urgency > BOUNDARY_ENGAGE) {
      boundaryEngaged = true
      crossings += 1
      if (slipsAway(seed, crossings)) {
        shore = 'leaving'
        return { heading, gain: GLIDE_GAIN }
      }
      // why: The itinerary must not keep pulling at the wall the koi is being pushed off — the next leg starts from open water.
      itinerary.abandon()
    } else if (boundaryEngaged && edge.urgency < BOUNDARY_RELEASE) {
      boundaryEngaged = false
    }
    if (boundaryEngaged) {
      const caution = 0.4 + traits.directionalCaution * 0.6
      cooldownUntilS = Math.max(cooldownUntilS, elapsed + 1)
      return { heading: Math.atan2(edge.inward.y, edge.inward.x), gain: 1 + edge.urgency * caution * 2 }
    }

    if (evasionHeading !== null) {
      cooldownUntilS = Math.max(cooldownUntilS, elapsed + 1)
      return { heading: evasionHeading, gain: 1 + evasionUrgency }
    }

    const damping = pond.reducedMotion ? REDUCED_MOTION_DAMPING : 1
    const ripple = wanderOffset(seed, elapsed) * WANDER_RIPPLE * damping
    const error = wrapAngle(course - heading)
    const finish = (): void => {
      // why: However a turn ends — course reached or clock expired — its cooldown starts, so turns come as separate events rather than a continuous correction.
      turnUntilS = 0
      turnDraws += 1
      cooldownUntilS = elapsed + lerp(wanderOffset(seed + 7, turnDraws * 13) * 0.5 + 0.5, TURN_COOLDOWN_S)
    }
    if (turnUntilS !== 0) {
      if (elapsed >= turnUntilS || Math.abs(error) < 0.06) {
        finish()
        return { heading: course + ripple, gain: GLIDE_GAIN }
      }
      return { heading: course, gain: 1 }
    }
    if (Math.abs(error) > TURN_TRIGGER && elapsed > cooldownUntilS) {
      turnUntilS = elapsed + Math.min(TURN_MAX_S, Math.abs(error) / lerp(traits.turnResponsiveness, TURN_RATE) + 0.3)
      return { heading: course, gain: 1 }
    }
    return { heading: course + ripple, gain: GLIDE_GAIN }
  }

  /**
   * The speed this koi is aiming for right now, in pixels per second.
   *
   * @returns The target speed.
   */
  const targetSpeed = (): number => {
    if (shore === 'away') {
      return 0
    }
    const damping = pond.reducedMotion ? REDUCED_MOTION_DAMPING : 1
    if (elapsed < fleeingUntilS) {
      return pond.fishLength * lerp(traits.reactionIntensity, ESCAPE_BL_S) * damping
    }
    // why: The trait sets this koi's own cruise; the pace schedule loafs and hurries it in bounded, exclusive events; an encounter's give-way scales ride on top.
    return pond.fishLength * lerp(traits.cruiseSpeed, CRUISE_BL_S) * pace.multiplier(elapsed) * paceScale
  }

  return {
    advance(dt) {
      elapsed += dt

      if (shore === 'leaving') {
        const bounds = pondBounds(pond)
        const clearance = bodyLength() * EXIT_CLEARANCE_BL
        const out = Math.max(bounds.left - position.x, position.x - bounds.right, bounds.top - position.y, position.y - bounds.bottom)
        if (out > clearance) {
          shore = 'away'
          awayUntilS = elapsed + SHORE_ABSENT_S
        }
      } else if (shore === 'away' && elapsed >= awayUntilS) {
        position = wrapAcross(pond, position)
        shore = 'returning'
        boundaryEngaged = false
        itinerary.abandon()
      } else if (shore === 'returning' && position.x > 0 && position.x < pond.width && position.y > 0 && position.y < pond.height) {
        shore = 'in'
      }

      if (elapsed - lastDecisionS >= DECISION_INTERVAL_S) {
        decide()
      }

      const previousHeading = heading
      const wanted = desire()
      const turnRate = lerp(traits.turnResponsiveness, TURN_RATE) * wanted.gain
      heading = turnToward(heading, wanted.heading, turnRate * dt)

      speed += (targetSpeed() - speed) * Math.min(1, SPEED_EASE * dt)
      if (shore !== 'away') {
        position = { x: position.x + Math.cos(heading) * speed * dt, y: position.y + Math.sin(heading) * speed * dt }
      }

      const turnedBy = Math.abs(wrapAngle(heading - previousHeading)) / Math.max(dt, 1e-6)
      if (elapsed < transitioningUntilS) {
        phase = 'depth-transition'
      } else if (elapsed < fleeingUntilS) {
        phase = 'escape'
      } else if (turnedBy > TURNING_ENTER || (phase === 'turning' && turnedBy > TURNING_EXIT)) {
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

    get isAway() {
      return shore === 'away'
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
