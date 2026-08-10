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
 * Every frame resolves one desired heading from four competing pulls, in strict
 * priority: get away from what struck the water, do not leave the pond, do not
 * hit anyone, and otherwise drift. Only the winning pull steers, which is what
 * keeps the motion legible instead of averaging into mush.
 */
import type {
  Disturbance,
  EncounterMemory,
  EncounterResolution,
  EncounterSelf,
  KoiOutline,
  KoiPhase,
  KoiProfile,
  KoiTune,
  NeighborObservation,
  PondEnvironment,
  SpineState,
  Vec2,
} from '@hyperfrontend/demo-koi-lib'
import {
  advanceSpine,
  boundaryPressure,
  createEncounterMemory,
  createSpine,
  depthScale,
  givesWay,
  headingAwayFrom,
  headingTo,
  pondCentre,
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

/** How far from the pond's centre this koi drifts before it starts leaning home, as a fraction of the shorter pond axis. */
const COMFORT_RATIO = 0.36

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
 * motion.advance(dt, elapsedS)
 * feature.send('outline', motion.outline())
 * ```
 */
export class KoiMotion {
  /** Everything about this koi that never changes. */
  readonly profile: KoiProfile

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

  /** Seconds since the pond opened, as of the last frame. */
  #elapsed = 0

  /** Elapsed reading this koi stops fleeing at. */
  #fleeingUntilS = 0

  /** Elapsed reading this koi stops reading as changing depth at. */
  #transitioningUntilS = 0

  /** Where the water last broke hard enough to send it running. */
  #threat: Vec2 | null = null

  /** The depth level it would like, until something reads the request. */
  #depthRequest: number | null = null

  /** The playground scales laid over this koi's own derived behaviour. */
  readonly #tune = { speed: 1, turn: 1, wander: 1, clearance: 1 }

  /** The per-neighbour memory that keeps a chosen avoidance side committed. */
  readonly #encounters: EncounterMemory = createEncounterMemory()

  /**
   * Places a koi in the pond and gives it its opening speed.
   *
   * @param options - Its profile, the pond, and where it enters.
   */
  constructor(options: KoiMotionOptions) {
    this.profile = options.profile
    this.#pond = options.pond
    this.#position = { ...options.position }
    this.#heading = options.heading
    this.#depth = options.depth
    this.#speed = options.pond.fishLength * lerp(options.profile.traits.cruiseSpeed, CRUISE_BL_S)
    this.#spine = createSpine(this.#position, this.#heading, this.#bodyLength())
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

  /**
   * Advances one frame.
   *
   * @param dt - Seconds since the previous frame.
   * @param elapsedS - Seconds since the pond opened.
   */
  advance(dt: number, elapsedS: number): void {
    this.#elapsed = elapsedS
    const previousHeading = this.#heading
    const wanted = this.#desire()
    const turnRate = lerp(this.profile.traits.turnResponsiveness, TURN_RATE) * wanted.gain * this.#tune.turn
    this.#heading = turnToward(this.#heading, wanted.heading, turnRate * dt)

    const target = this.#targetSpeed()
    this.#speed += (target - this.#speed) * Math.min(1, SPEED_EASE * dt)
    this.#position = {
      x: this.#position.x + Math.cos(this.#heading) * this.#speed * dt,
      y: this.#position.y + Math.sin(this.#heading) * this.#speed * dt,
    }

    const turnedBy = Math.abs(turnToward(0, this.#heading - previousHeading, Math.PI)) / Math.max(dt, 1e-6)
    if (this.#elapsed < this.#transitioningUntilS) {
      this.#phase = 'depth-transition'
    } else if (this.#elapsed < this.#fleeingUntilS) {
      this.#phase = 'escape'
    } else if (turnedBy > TURNING_THRESHOLD) {
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
   * Takes the visitor's playground settings; anything left out keeps its value.
   *
   * @param tune - The scales to apply over this koi's own derived behaviour.
   */
  setTune(tune: KoiTune): void {
    this.#tune.speed = tune.speedScale ?? this.#tune.speed
    this.#tune.turn = tune.turnScale ?? this.#tune.turn
    this.#tune.wander = tune.wanderScale ?? this.#tune.wander
    this.#tune.clearance = tune.clearanceScale ?? this.#tune.clearance
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
   * The heading this koi wants, and how hard it is committed to it.
   *
   * @returns The desired heading and the turn gain to reach it with.
   */
  #desire(): Desire {
    const { traits } = this.profile
    if (this.#threat !== null && this.#elapsed < this.#fleeingUntilS) {
      return { heading: headingAwayFrom(this.#position, this.#threat, this.#heading), gain: ESCAPE_TURN_GAIN }
    }

    const edge = boundaryPressure(this.#pond, this.#position, this.#heading)
    // why: The boundary is the one pull that can override a crossing — a koi that dodges a neighbour into open air has left the pond.
    if (edge.urgency > 0.08) {
      const caution = 0.4 + traits.directionalCaution * 0.6
      return { heading: Math.atan2(edge.inward.y, edge.inward.x), gain: 1 + edge.urgency * caution * 2 }
    }

    for (const neighbor of this.#neighbors) {
      // why: The memory holds the side this koi first chose against each neighbour — near the crossing point the raw bearing flips sign frame to frame, and steering on it raw is what read as vibration.
      const resolution = this.#encounters.resolve(
        this.#encounterSelf(),
        neighbor,
        givesWay(this.profile.framework, neighbor.framework),
        this.#elapsed
      )
      if (resolution.action === 'hold') {
        continue
      }
      if (resolution.depth !== null) {
        this.#depthRequest = resolution.depth
        continue
      }
      if (resolution.action === 'turn') {
        // why: The offset follows the urgency, so a grazing encounter asks for a lean while only a genuine collision course asks for the full break.
        return {
          heading: this.#heading + resolution.turn * (Math.PI / 3) * (0.4 + 0.6 * resolution.urgency),
          gain: 1 + resolution.urgency,
        }
      }
      // note: `slow` and `accelerate` settle an overtaking without a course change, so the koi keeps steering on whatever comes next.
    }

    const damping = this.#pond.reducedMotion ? REDUCED_MOTION_DAMPING : 1
    const drift = wanderOffset(traits.awareness * 1000, this.#elapsed) * 0.55 * damping * this.#tune.wander
    const centre = pondCentre(this.#pond)
    const fromCentre = Math.hypot(this.#position.x - centre.x, this.#position.y - centre.y)
    const comfort = Math.min(this.#pond.width, this.#pond.height) * COMFORT_RATIO
    // why: A weak lean home keeps the shoal loosely orbiting the middle of the pond, so the water a small window looks into is rarely empty; inside the comfort radius the lean vanishes and the drift is all there is.
    const overshoot = Math.min(1, Math.max(0, (fromCentre - comfort) / comfort))
    const wandering = turnToward(this.#heading + drift, headingTo(this.#position, centre), overshoot * 0.8)
    return { heading: wandering, gain: 0.35 + overshoot * 0.3 }
  }

  /**
   * The speed this koi is aiming for right now, in pixels per second.
   *
   * @returns The target speed.
   */
  #targetSpeed(): number {
    const { traits } = this.profile
    if (this.#elapsed < this.#fleeingUntilS) {
      const damping = this.#pond.reducedMotion ? REDUCED_MOTION_DAMPING : 1
      return this.#pond.fishLength * lerp(traits.reactionIntensity, ESCAPE_BL_S) * damping * this.#tune.speed
    }
    let cruise = this.#pond.fishLength * lerp(traits.cruiseSpeed, CRUISE_BL_S) * this.#tune.speed
    for (const neighbor of this.#neighbors) {
      const resolution = this.#resolve(neighbor)
      if (resolution.action === 'slow') {
        cruise *= 1 - 0.45 * resolution.urgency
      } else if (resolution.action === 'accelerate') {
        cruise *= 1 + 0.5 * resolution.urgency
      }
    }
    return cruise
  }

  /**
   * Works out what this koi should do about one neighbour, geometry alone.
   *
   * @param neighbor - The koi it might be about to meet.
   * @returns How the shared steering rules settle the encounter.
   */
  #resolve(neighbor: NeighborObservation): EncounterResolution {
    return resolveEncounter(this.#encounterSelf(), neighbor, givesWay(this.profile.framework, neighbor.framework))
  }

  /**
   * How this koi presents itself to the shared encounter resolver.
   *
   * @returns Its position, course, and the water its body claims.
   */
  #encounterSelf(): EncounterSelf & { clearanceScale: number } {
    return {
      position: this.#position,
      heading: this.#heading,
      speed: this.#speed,
      depth: this.#depth,
      length: this.#bodyLength(),
      girth: this.#bodyLength() * this.profile.build.girthRatio,
      clearanceScale: this.#tune.clearance,
      traits: this.profile.traits,
    }
  }
}
