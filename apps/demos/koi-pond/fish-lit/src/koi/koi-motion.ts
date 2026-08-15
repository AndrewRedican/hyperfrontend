/**
 * This koi's swimming brain.
 *
 * Framework-free on purpose: it is driven by a plain `advance(dt)` and holds no
 * DOM, so it can be unit-tested frame by frame and so the custom element next
 * door is genuinely the only browser-facing part of this app.
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
  EncounterSelf,
  Itinerary,
  KoiOutline,
  KoiPhase,
  KoiProfile,
  NeighborObservation,
  PaceSchedule,
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

/** How long the roll between two depth levels reads as a state of its own, in seconds. */
const DEPTH_ROLL_S = 1.4

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

/** The heading this koi wants, and how hard it is committed to reaching it. */
interface Desire {
  /** The heading to steer toward, in radians. */
  heading: number
  /** Multiplier on the koi's turn rate while it steers there. */
  gain: number
}

/**
 * This koi's swimming brain: one fish's judgement, one frame at a time.
 *
 * @example Swimming a koi
 * ```typescript
 * const motion = new KoiMotion({ profile, pond, position, heading, depth })
 * motion.advance(dt)
 * feature.send('outline', motion.outline())
 * ```
 */
export class KoiMotion {
  /** Everything about this koi that never changes. */
  readonly profile: KoiProfile

  /** The seed all of this koi's scheduled behaviour draws from. */
  readonly #seed: number

  /** The world it swims in, replaced whenever the host announces a resize. */
  #pond: PondEnvironment

  /** Its nose in pond space. */
  #position: Vec2

  /** Its heading in radians. */
  #heading: number

  /** The depth level it holds. */
  #depth: number

  /** Its speed in pixels per second. */
  #speed: number

  /** Its centreline. */
  #spine: SpineState

  /** The behavioural state its body reads in. */
  #phase: KoiPhase = 'relaxed'

  /** The koi close enough to matter, as the host last relayed them. */
  #neighbors: readonly NeighborObservation[] = []

  /** Seconds this brain has swum, accumulated from every `advance`. */
  #elapsed = 0

  /** Elapsed reading this koi stops fleeing at. */
  #fleeingUntilS = 0

  /** Elapsed reading this koi stops reading as changing depth at. */
  #transitioningUntilS = 0

  /** Where the water last broke hard enough to send it running. */
  #threat: Vec2 | null = null

  /** The depth level it would like, until something reads the request. */
  #depthRequest: number | null = null

  /** Where this koi stands with the shoreline. */
  #shore: ShoreState = 'in'

  /** How many boundary approaches have engaged a correction so far. */
  #crossings = 0

  /** Elapsed reading an absent koi warps back across the pond at. */
  #awayUntilS = 0

  /** Whether the boundary correction is currently engaged. */
  #boundaryEngaged = false

  /** Elapsed reading of the last decision tick. */
  #lastDecisionS = -DECISION_INTERVAL_S

  /** The itinerary heading the koi is cruising along between manoeuvres. */
  #course: number

  /** The evasion an encounter anchored, held as an absolute heading. */
  #evasionHeading: number | null = null

  /** How urgent that anchored evasion was when it was made. */
  #evasionUrgency = 0

  /** The give-way scale encounters lay over the scheduled pace. */
  #paceScale = 1

  /** Elapsed reading the running ordinary turn ends at, or `0` outside one. */
  #turnUntilS = 0

  /** Elapsed reading before which no ordinary turn may start. */
  #cooldownUntilS = 0

  /** How many ordinary turns have finished, seeding each cooldown draw. */
  #turnDraws = 0

  /** The per-neighbour memory that keeps a chosen manoeuvre committed. */
  readonly #encounters = createEncounterMemory()

  /** The seeded loaf-brisk-burst schedule this koi paces itself by. */
  readonly #pace: PaceSchedule

  /** The seeded waypoints this koi swims legs between. */
  readonly #itinerary: Itinerary

  /**
   * Places a koi in the pond and gives it its opening speed.
   *
   * @param options - Its profile, the pond, and where it enters.
   */
  constructor(options: KoiMotionOptions) {
    this.profile = options.profile
    this.#seed = koiSeed(options.profile.framework)
    this.#pond = options.pond
    this.#position = { ...options.position }
    this.#heading = options.heading
    this.#course = options.heading
    this.#depth = options.depth
    this.#speed = options.pond.fishLength * lerp(options.profile.traits.cruiseSpeed, CRUISE_BL_S)
    this.#spine = createSpine(this.#position, this.#heading, this.#bodyLength())
    this.#pace = createPaceSchedule(this.#seed)
    this.#itinerary = createItinerary(this.#seed)
  }

  /** What the koi is doing right now. */
  get state(): KoiState {
    return {
      position: this.#position,
      heading: this.#heading,
      speed: this.#speed,
      phase: this.#phase,
      depth: this.#depth,
      length: this.#bodyLength(),
      spine: this.#spine,
    }
  }

  /** Whether it is still fleeing. */
  get isFleeing(): boolean {
    return this.#elapsed < this.#fleeingUntilS
  }

  /** Whether it has slipped out of the pond and is waiting to return. */
  get isAway(): boolean {
    return this.#shore === 'away'
  }

  /**
   * Advances one frame.
   *
   * The brain keeps its own clock by accumulating `dt`, so a stalled tab
   * resumes mid-behaviour instead of fast-forwarding through expired events.
   *
   * @param dt - Seconds since the previous frame.
   */
  advance(dt: number): void {
    this.#elapsed += dt

    if (this.#shore === 'leaving') {
      const bounds = pondBounds(this.#pond)
      const clearance = this.#bodyLength() * EXIT_CLEARANCE_BL
      const out = Math.max(
        bounds.left - this.#position.x,
        this.#position.x - bounds.right,
        bounds.top - this.#position.y,
        this.#position.y - bounds.bottom
      )
      if (out > clearance) {
        this.#shore = 'away'
        this.#awayUntilS = this.#elapsed + SHORE_ABSENT_S
      }
    } else if (this.#shore === 'away' && this.#elapsed >= this.#awayUntilS) {
      this.#position = wrapAcross(this.#pond, this.#position)
      this.#shore = 'returning'
      this.#boundaryEngaged = false
      this.#itinerary.abandon()
    } else if (
      this.#shore === 'returning' &&
      this.#position.x > 0 &&
      this.#position.x < this.#pond.width &&
      this.#position.y > 0 &&
      this.#position.y < this.#pond.height
    ) {
      this.#shore = 'in'
    }

    if (this.#elapsed - this.#lastDecisionS >= DECISION_INTERVAL_S) {
      this.#decide()
    }

    const previousHeading = this.#heading
    const wanted = this.#desire()
    const turnRate = lerp(this.profile.traits.turnResponsiveness, TURN_RATE) * wanted.gain
    this.#heading = turnToward(this.#heading, wanted.heading, turnRate * dt)

    this.#speed += (this.#targetSpeed() - this.#speed) * Math.min(1, SPEED_EASE * dt)
    if (this.#shore !== 'away') {
      this.#position = {
        x: this.#position.x + Math.cos(this.#heading) * this.#speed * dt,
        y: this.#position.y + Math.sin(this.#heading) * this.#speed * dt,
      }
    }

    const turnedBy = Math.abs(wrapAngle(this.#heading - previousHeading)) / Math.max(dt, 1e-6)
    if (this.#elapsed < this.#transitioningUntilS) {
      this.#phase = 'depth-transition'
    } else if (this.#elapsed < this.#fleeingUntilS) {
      this.#phase = 'escape'
    } else if (turnedBy > TURNING_ENTER || (this.#phase === 'turning' && turnedBy > TURNING_EXIT)) {
      this.#phase = 'turning'
    } else {
      this.#phase = 'relaxed'
    }

    this.#spine = advanceSpine(this.#spine, {
      nose: this.#position,
      length: this.#bodyLength(),
      speed: this.#speed,
      phase: this.#phase,
      dt,
      reducedMotion: this.#pond.reducedMotion,
    })
  }

  /**
   * Adopts a resized pond.
   *
   * @param pond - The newly announced world.
   */
  setPond(pond: PondEnvironment): void {
    this.#pond = pond
  }

  /**
   * Takes the depth level the host granted.
   *
   * @param level - The new level.
   */
  setDepth(level: number): void {
    if (level === this.#depth) {
      return
    }
    this.#depth = level
    this.#depthRequest = null
    // why: The roll between levels is a visible state of its own, so the body reads as changing depth rather than merely resizing.
    this.#transitioningUntilS = this.#elapsed + DEPTH_ROLL_S
  }

  /**
   * Reacts to something striking the water.
   *
   * Whether the koi actually bolts is its own business: a shy fish flees a
   * distant splash, a bold one ignores one that landed beside it.
   *
   * @param disturbance - Where the water broke and how hard.
   * @returns `true` when this koi startled.
   */
  startle(disturbance: Disturbance): boolean {
    const { traits } = this.profile
    const reach = this.#pond.fishLength * lerp(traits.awareness, AWARENESS_BL)
    const distance = Math.hypot(this.#position.x - disturbance.x, this.#position.y - disturbance.y)
    if (distance > reach) {
      return false
    }
    // how: What the koi feels is the strike damped by how far off it landed; whether that beats its nerve is what the shyness trait decides.
    const felt = disturbance.intensity * (1 - distance / reach)
    if (felt < 0.5 - traits.shyness * 0.45) {
      return false
    }
    this.#threat = { x: disturbance.x, y: disturbance.y }
    this.#fleeingUntilS = this.#elapsed + lerp(traits.reactionIntensity, ESCAPE_S) * (0.6 + felt * 0.6)
    return true
  }

  /**
   * Takes the host's relayed view of who is nearby.
   *
   * @param neighbors - The koi close enough to matter.
   */
  observe(neighbors: readonly NeighborObservation[]): void {
    this.#neighbors = neighbors
  }

  /**
   * The compact outline the host does its proximity work against.
   *
   * @returns The outline to report.
   */
  outline(): KoiOutline {
    return {
      framework: this.profile.framework,
      spine: sampleSpine(this.#spine.joints, OUTLINE_SAMPLES),
      girth: sampleSpine(spineGirth(this.#bodyLength(), this.profile.build.girthRatio), OUTLINE_SAMPLES),
      heading: this.#heading,
      speed: this.#speed,
      depth: this.#depth,
      phase: this.#phase,
    }
  }

  /**
   * The depth level this koi would like, or `null` when it is content.
   *
   * Cleared once read, so a request is made once rather than every frame.
   *
   * @returns The requested level, or `null`.
   */
  takeDepthRequest(): number | null {
    const requested = this.#depthRequest
    this.#depthRequest = null
    return requested
  }

  /**
   * Its nose-to-tail length at its current depth, in CSS pixels.
   *
   * @returns The body length.
   */
  #bodyLength(): number {
    return this.#pond.fishLength * this.profile.build.lengthScale * depthScale(this.#depth)
  }

  /**
   * How this koi presents itself to the shared encounter memory.
   *
   * @returns Its position, course, and the water its body claims.
   */
  #encounterSelf(): EncounterSelf {
    const length = this.#bodyLength()
    return {
      position: this.#position,
      heading: this.#heading,
      speed: this.#speed,
      depth: this.#depth,
      length,
      girth: length * this.profile.build.girthRatio,
      traits: this.profile.traits,
    }
  }

  /**
   * Re-forms the koi's judgement: the itinerary leg, the pace, and how every
   * nearby crossing is settled.
   *
   * Runs at its own low cadence rather than every frame, and anchors any
   * evasion as an absolute heading — a target that chased the koi's own moving
   * heading is what used to walk the shoal into circles.
   */
  #decide(): void {
    this.#lastDecisionS = this.#elapsed
    this.#paceScale = 1
    this.#evasionHeading = null
    this.#evasionUrgency = 0

    const self = this.#encounterSelf()
    for (const neighbor of this.#neighbors) {
      const resolution = this.#encounters.resolve(self, neighbor, givesWay(this.profile.framework, neighbor.framework), this.#elapsed)
      if (resolution.action === 'hold') {
        continue
      }
      if (resolution.depth !== null) {
        this.#depthRequest = resolution.depth
        continue
      }
      if (resolution.action === 'slow') {
        this.#paceScale = Math.max(0.4, this.#paceScale * (1 - 0.45 * resolution.urgency))
      } else if (resolution.action === 'accelerate') {
        this.#paceScale = Math.min(1.7, this.#paceScale * (1 + 0.5 * resolution.urgency))
      } else if (resolution.urgency >= this.#evasionUrgency) {
        // why: The arc follows the urgency, so a grazing encounter asks for a lean while only a genuine collision course asks for the full break.
        this.#evasionUrgency = resolution.urgency
        this.#evasionHeading = this.#heading + resolution.turn * lerp(resolution.urgency, EVASION_TURN)
      }
    }

    if (this.#shore === 'in') {
      this.#course = headingTo(this.#position, this.#itinerary.current(this.#pond, this.#position, this.#elapsed).point)
    }
  }

  /**
   * The heading this koi wants, and how hard it is committed to it.
   *
   * @returns The desired heading and the turn gain to reach it with.
   */
  #desire(): Desire {
    const { traits } = this.profile
    if (this.#threat !== null && this.#elapsed < this.#fleeingUntilS) {
      return { heading: headingAwayFrom(this.#position, this.#threat, this.#heading), gain: ESCAPE_TURN_GAIN }
    }

    // why: A koi that chose to slip out holds its course — the whole point of the slip is that the correction was ignored.
    if (this.#shore === 'leaving' || this.#shore === 'away') {
      return { heading: this.#heading, gain: GLIDE_GAIN }
    }

    if (this.#shore === 'returning') {
      // why: The itinerary's course predates the absence; until the koi is back inside, the only sensible pull is open water.
      return { heading: headingTo(this.#position, pondCentre(this.#pond)), gain: 0.5 }
    }

    const edge = boundaryPressure(this.#pond, this.#position, this.#heading)
    // why: Engage and release at different urgencies — a single threshold flickers the correction on and off at the margin, and that flicker is the left-right-left vibration.
    if (!this.#boundaryEngaged && edge.urgency > BOUNDARY_ENGAGE) {
      this.#boundaryEngaged = true
      this.#crossings += 1
      if (slipsAway(this.#seed, this.#crossings)) {
        this.#shore = 'leaving'
        return { heading: this.#heading, gain: GLIDE_GAIN }
      }
      // why: The itinerary must not keep pulling at the wall the koi is being pushed off — the next leg starts from open water.
      this.#itinerary.abandon()
    } else if (this.#boundaryEngaged && edge.urgency < BOUNDARY_RELEASE) {
      this.#boundaryEngaged = false
    }
    if (this.#boundaryEngaged) {
      const caution = 0.4 + traits.directionalCaution * 0.6
      this.#cooldownUntilS = Math.max(this.#cooldownUntilS, this.#elapsed + 1)
      return { heading: Math.atan2(edge.inward.y, edge.inward.x), gain: 1 + edge.urgency * caution * 2 }
    }

    if (this.#evasionHeading !== null) {
      this.#cooldownUntilS = Math.max(this.#cooldownUntilS, this.#elapsed + 1)
      return { heading: this.#evasionHeading, gain: 1 + this.#evasionUrgency }
    }

    const damping = this.#pond.reducedMotion ? REDUCED_MOTION_DAMPING : 1
    const ripple = wanderOffset(this.#seed, this.#elapsed) * WANDER_RIPPLE * damping
    const error = wrapAngle(this.#course - this.#heading)
    const finish = (): void => {
      // why: However a turn ends — course reached or clock expired — its cooldown starts, so turns come as separate events rather than a continuous correction.
      this.#turnUntilS = 0
      this.#turnDraws += 1
      this.#cooldownUntilS = this.#elapsed + lerp(wanderOffset(this.#seed + 7, this.#turnDraws * 13) * 0.5 + 0.5, TURN_COOLDOWN_S)
    }
    if (this.#turnUntilS !== 0) {
      if (this.#elapsed >= this.#turnUntilS || Math.abs(error) < 0.06) {
        finish()
        return { heading: this.#course + ripple, gain: GLIDE_GAIN }
      }
      return { heading: this.#course, gain: 1 }
    }
    if (Math.abs(error) > TURN_TRIGGER && this.#elapsed > this.#cooldownUntilS) {
      this.#turnUntilS = this.#elapsed + Math.min(TURN_MAX_S, Math.abs(error) / lerp(traits.turnResponsiveness, TURN_RATE) + 0.3)
      return { heading: this.#course, gain: 1 }
    }
    return { heading: this.#course + ripple, gain: GLIDE_GAIN }
  }

  /**
   * The speed this koi is aiming for right now, in pixels per second.
   *
   * @returns The target speed.
   */
  #targetSpeed(): number {
    const { traits } = this.profile
    if (this.#shore === 'away') {
      return 0
    }
    const damping = this.#pond.reducedMotion ? REDUCED_MOTION_DAMPING : 1
    if (this.#elapsed < this.#fleeingUntilS) {
      return this.#pond.fishLength * lerp(traits.reactionIntensity, ESCAPE_BL_S) * damping
    }
    // why: The trait sets this koi's own cruise; the pace schedule loafs and hurries it in bounded, exclusive events; an encounter's give-way scales ride on top.
    return this.#pond.fishLength * lerp(traits.cruiseSpeed, CRUISE_BL_S) * this.#pace.multiplier(this.#elapsed) * this.#paceScale
  }
}
