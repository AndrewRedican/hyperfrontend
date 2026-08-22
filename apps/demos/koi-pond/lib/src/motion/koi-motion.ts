/**
 * The koi steering brain: one fish's judgement, one frame at a time.
 *
 * Framework-free and DOM-free, driven by a plain `advance(dt)`, so it can be
 * unit-tested frame by frame and a renderer stays the only browser-facing part
 * of any app that swims a koi.
 *
 * Motion is event-shaped rather than noise-shaped. The koi swims legs of a
 * seeded itinerary at a seeded pace; a change of course is a discrete turn that
 * begins, runs its bounded arc, ends, and is followed by a cooldown before the
 * next ordinary turn may start. Heavier pulls interrupt in strict priority
 * (flee what struck the water, come back to the pond, settle a crossing), and
 * each decision is anchored when it is made rather than re-derived against the
 * koi's own moving heading.
 *
 * Manoeuvres are costed. An avoidance commits the least effort that is
 * predicted to clear the obstacle, out of three tiers permitted by how near the
 * crossing is; it breaks toward whichever flank the water reads clearer, and
 * toward its right when the two read the same; and it brakes in proportion to
 * the helm it wound on, so a koi slows into a turn and picks its pace back up
 * out of it.
 *
 * Every band, cadence, and physical limit the brain steers by is an option, and
 * two runtime hooks open the judgement itself: {@link KoiMotionOptions.onDecision}
 * watches what the brain commits to, and {@link KoiMotionOptions.desire} biases
 * the ladder that produced it. A koi built without options swims the shared
 * default.
 */
import { randomPseudo } from '@hyperfrontend/random-generator-utils'
import type {
  Disturbance,
  KoiIntent,
  KoiOutline,
  KoiPhase,
  KoiProfile,
  NeighborObservation,
  PondEnvironment,
  Vec2,
} from '../model/types.js'
import type { SpineState } from '../geometry/spine.js'
import type { KoiTurnTierName, KoiTurnTiers, KoiTurnTierWindows } from './manoeuvre.js'
import { SHORE_ABSENT_S, createItinerary, createPaceSchedule, slipsAway, wrapAcross } from '../geometry/behaviour.js'
import { advanceSpine, createSpine, sampleSpine, spineGirth } from '../geometry/spine.js'
import {
  ENCOUNTER_CLEARANCE,
  ENCOUNTER_HORIZON_S,
  createEncounterMemory,
  encounterClearance,
  givesWay,
  headingAwayFrom,
  headingTo,
  turnToward,
  wanderOffset,
  wrapAngle,
} from '../geometry/steering.js'
import { boundaryPressure, pondBounds, pondCentre } from '../geometry/virtual-pond.js'
import { depthScale } from '../model/depth.js'
import { koiSeed } from '../model/traits.js'
import type { KoiFlightAim, KoiFlightTerms } from './predict.js'
import { stepFlight } from './predict.js'
import { chooseTurnTier, flankCrowding } from './manoeuvre.js'

/** How many spine samples travel in a reported outline. */
const OUTLINE_SAMPLES = 5

/** Where the avoidance side's draw band starts on the koi's seed. */
const BREAK_DRAWS = 640

/** A trait band: what the koi with the lowest trait gets, and what the koi with the highest gets. */
export interface KoiMotionBand {
  /** The value at trait 0. */
  min: number
  /** The value at trait 1. */
  max: number
}

/** The bands, thresholds, and cadences a koi's judgement is drawn from. */
export interface KoiMotionTrim {
  /** Cruise speed band in body lengths per second, from the slowest koi to the briskest. */
  cruiseBlS: KoiMotionBand
  /** Escape speed band in body lengths per second. */
  escapeBlS: KoiMotionBand
  /** Escape duration band in seconds. */
  escapeS: KoiMotionBand
  /** How much faster a fleeing koi can turn than a cruising one. */
  escapeTurnGain: number
  /** Turn rate band in radians per second at a relaxed cruise. */
  turnRate: KoiMotionBand
  /** The bearing error that schedules an ordinary turn rather than a drift, in radians. */
  turnTrigger: number
  /** Longest an ordinary turn may run, in seconds. */
  turnMaxS: number
  /** The cooldown band after an ordinary turn, in seconds, drawn from the koi's seed. */
  turnCooldownS: KoiMotionBand
  /** The measured turn rate that reads as `turning`. */
  turningEnter: number
  /** The softer measured turn rate that releases `turning`. */
  turningExit: number
  /** How firmly the koi corrects its course between turns: a drift, not a manoeuvre. */
  glideGain: number
  /** How much ambient waviness rides on a straight leg, in radians. */
  wanderRipple: number
  /** How quickly speed eases toward its target, as a fraction closed per second. */
  speedEase: number
  /** How far a koi notices things, in body lengths, at the extremes of its awareness trait. */
  awarenessBl: KoiMotionBand
  /** How much reduced motion damps wandering and escape intensity. */
  reducedMotionDamping: number
  /** How often the koi re-forms its judgement about neighbours and its itinerary, in seconds. */
  decisionIntervalS: number
  /** The boundary urgency that engages a correction. */
  boundaryEngage: number
  /** The softer boundary urgency that releases the correction. */
  boundaryRelease: number
  /** The three manoeuvre tiers an avoidance is drawn from. */
  evasionTiers: KoiTurnTiers
  /** How near a crossing has to be before each tier is permitted. */
  tierWindowS: KoiTurnTierWindows
  /** How much of its pace a koi sheds when it puts its whole helm into a turn, 0 to 1. */
  turnBrake: number
  /** How often a koi with nothing to choose between breaks toward its right flank, 0 to 1. */
  rightBias: number
  /** How lopsided the water has to read before the field decides the side rather than the bias. */
  sideEvidence: number
  /** How far past the hard boundary a slipping koi swims before its absence starts, in body lengths. */
  exitClearanceBl: number
  /** How long a koi reads as rolling between two depth levels, in seconds. */
  depthRollS: number
  /** How long a decided depth pass stays readable in the intent report, in seconds. */
  depthIntentHoldS: number
  /** How far a carried koi leans toward where it is being led, in radians per placement. */
  placeLeanRad: number
  /** A placement below this step is pointer jitter, not leading, in CSS pixels. */
  placeLeadMinPx: number
  /** The nominal frame the spine trails through per placement while carried, in seconds. */
  placeFollowS: number
  /** How long a released koi drifts before its next ordinary turn may start, in seconds. */
  placeSettleS: number
}

/** The physical bounds no koi may exceed, whatever bands, traits, and multipliers stack. */
export interface KoiMotionLimits {
  /** The hardest any koi may ever swim, in body lengths per second. */
  maxSpeedBlS: number
  /** The hardest a koi can accelerate or brake, in body lengths per second squared. */
  accelLimitBlS2: number
  /** How hard a koi can wind its turn rate up or down, in radians per second squared. */
  turnAccel: number
  /** How firmly remaining course error asks for turn rate, per second: the ramp-out of every turn. */
  turnApproach: number
  /** How much swimming past cruise pace taxes the helm, per body length per second of excess. */
  turnSpeedTax: number
  /** The share of every turn-rate ceiling anything may actually command, 0 to 1. */
  turnMagnitudeCap: number
}

/** The trim every koi swims by unless its options say otherwise. */
export const DEFAULT_MOTION_TRIM: KoiMotionTrim = {
  cruiseBlS: { min: 0.26, max: 0.62 },
  escapeBlS: { min: 1.9, max: 3.4 },
  escapeS: { min: 1.1, max: 2.9 },
  escapeTurnGain: 1.7,
  turnRate: { min: 0.35, max: 0.8 },
  turnTrigger: 0.5,
  turnMaxS: 3,
  turnCooldownS: { min: 4, max: 9 },
  turningEnter: 0.42,
  turningExit: 0.3,
  glideGain: 0.12,
  wanderRipple: 0.12,
  speedEase: 3.2,
  awarenessBl: { min: 2.2, max: 5.4 },
  reducedMotionDamping: 0.45,
  decisionIntervalS: 0.1,
  boundaryEngage: 0.12,
  boundaryRelease: 0.05,
  // why: Each tier is the smallest arc that settles its band of crossing, and its gain matches, because a lazy arc steered at full helm is not a lazy manoeuvre.
  evasionTiers: {
    subtle: { arc: Math.PI / 10, gain: 0.55 },
    normal: { arc: Math.PI / 5, gain: 1 },
    hard: { arc: Math.PI / 3, gain: 1.6 },
  },
  // why: Nearness is time to the closest approach rather than distance, so a fast crossing counts as near while a drifting one at the same range does not.
  tierWindowS: { hardS: 0.8, normalS: 1.6 },
  // why: Commanded braking: what the manoeuvre a koi chose costs it in pace. It is charged against cruise alone, because what uncommanded speed costs the helm is `turnSpeedTax`, and the two must never charge for the same thing twice.
  turnBrake: 0.35,
  // why: Two koi meeting head-on read exactly the same even water, so an even reading has to resolve to the same flank in both frames or neither of them clears.
  rightBias: 0.7,
  // why: A hair of asymmetry is not evidence; below this the water counts as even and the bias decides.
  sideEvidence: 0.02,
  exitClearanceBl: 0.6,
  depthRollS: 1.4,
  depthIntentHoldS: 3,
  placeLeanRad: 0.015,
  placeLeadMinPx: 0.5,
  placeFollowS: 0.05,
  placeSettleS: 2,
}

/** The limits every koi obeys unless its options say otherwise. */
export const DEFAULT_MOTION_LIMITS: KoiMotionLimits = {
  maxSpeedBlS: 3.4,
  accelLimitBlS2: 2.6,
  turnAccel: 2.2,
  turnApproach: 1.8,
  // why: Passive drag alone: what speed the koi did not ask for does to its helm. It reads only the excess over cruise, so the pace a chosen manoeuvre costs stays `turnBrake`'s to charge and the pair never stacks on one turn.
  turnSpeedTax: 0.45,
  // why: Every ceiling above belongs to a fish rather than to a fighter jet, and nothing the judgement commits, escapes included, may command a larger share of one.
  turnMagnitudeCap: 0.8,
}

/**
 * Maps a normalised trait onto a band.
 *
 * @param trait - The trait, 0 to 1.
 * @param band - The band to map onto.
 * @returns The mapped value.
 */
function lerp(trait: number, band: KoiMotionBand): number {
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
  /**
   * The turn rate it currently has wound up, in radians per second.
   *
   * Positive swings the heading clockwise on screen, toward the koi's right
   * flank. The rate is a state with bounded acceleration rather than a fresh
   * reading each frame, so it is what a manoeuvre already committed to carries
   * forward.
   */
  turnVelocity: number
  /** The behavioural state its body reads in. */
  phase: KoiPhase
  /** The depth level the host granted. */
  depth: number
  /** Its nose-to-tail length at its current depth, in CSS pixels. */
  length: number
  /** Its centreline. */
  spine: SpineState
}

/** What prompted the koi's current decision. */
export type KoiDecisionCause =
  /** Bolting from something that struck the water. */
  | 'flee'
  /** Holding course out of the pond, having chosen to slip away. */
  | 'slip'
  /** Swimming back to open water after an absence. */
  | 'return'
  /** Being pushed off the shoreline. */
  | 'boundary'
  /** Breaking off an evasion arc decided against a neighbour. */
  | 'evade'
  /** Changing depth to pass a neighbour. */
  | 'pass'
  /** Running a scheduled turn onto the itinerary's course. */
  | 'turn'
  /** Drifting along the current leg between turns. */
  | 'glide'

/** The heading a koi wants, how hard it is committed to reaching it, and which decision family asked for it. */
export interface KoiDesire {
  /** The heading to steer toward, in radians. */
  heading: number
  /** The multiplier on this koi's turn rate while it steers there. */
  gain: number
  /** The decision family: `avoid` for every collision-avoidance pull, `travel` for ordinary progress. */
  kind: 'travel' | 'avoid'
}

/** The rule a koi steers by, asked for the flight it is about to take. */
type KoiMotionAim = (position: Vec2, heading: number, atS: number) => KoiFlightAim

/** What the koi knows about itself as it forms a desire. */
export interface KoiSteerContext {
  /** The koi's own accumulated clock, in seconds. */
  atS: number
  /** What prompted the desire the brain formed. */
  cause: KoiDecisionCause
  /** Its nose in pond space. */
  position: Vec2
  /** Its heading in radians. */
  heading: number
  /** Its speed in pixels per second. */
  speed: number
  /** The depth level the host granted. */
  depth: number
  /** The world it swims in. */
  pond: PondEnvironment
}

/** A decision the koi has just committed to. */
export interface KoiDecision {
  /** The koi's own accumulated clock when it committed, in seconds. */
  atS: number
  /** What prompted it. */
  cause: KoiDecisionCause
  /** The decision family, matching the outline's intent kind. */
  kind: 'travel' | 'avoid' | 'depth-change'
  /** The heading it steers toward, in radians, or `null` when the manoeuvre is vertical. */
  heading: number | null
  /** The turn gain a horizontal manoeuvre steers with, or the encounter urgency behind a depth pass. */
  gain: number
  /** The depth level a pass asks the host for, or `null`. */
  depth: number | null
  /** How much effort the koi's own avoidance arc commits, or `null` when what it decided was not one. */
  tier: KoiTurnTierName | null
}

/** How this koi starts its life in the pond. */
export interface KoiMotionInit {
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

/** How this koi's judgement differs from the shared default. */
export interface KoiMotionOptions {
  /** Bands, thresholds, and cadences to swim by; anything left out keeps its {@link DEFAULT_MOTION_TRIM} value. */
  trim?: Partial<KoiMotionTrim>
  /** Physical bounds to obey; anything left out keeps its {@link DEFAULT_MOTION_LIMITS} value. */
  limits?: Partial<KoiMotionLimits>
  /**
   * Watches what the koi commits to.
   *
   * Fires when the family of what the koi is doing changes and when it decides
   * to pass a neighbour at another depth, not on every frame that a standing
   * intention persists. Does nothing by default.
   */
  onDecision?: (decision: KoiDecision) => void
  /**
   * Biases the desire the koi formed for itself.
   *
   * Runs after the whole ladder has resolved, so a consumer sees the winning
   * pull and its cause and can lean it, damp it, or replace it outright without
   * reimplementing the priorities underneath. Returns the desire unchanged by
   * default.
   */
  desire?: (desire: KoiDesire, context: KoiSteerContext) => KoiDesire
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
  /**
   * Carries the koi to a point while a visitor drags it.
   *
   * The body trails through the drag path and leans gently toward where it is
   * being led; every standing intention, the flee, the evasion, the scheduled
   * turn, is dropped, so releasing the koi resumes a calm cruise from wherever
   * it was set down rather than whatever manoeuvre the grab interrupted.
   *
   * @param point - Where the koi's nose is being carried, in pond space.
   */
  place(point: Vec2): void
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
 * Creates a koi's swimming brain.
 *
 * @param init - Its profile, the pond, and where it enters.
 * @param options - How its judgement differs from the shared default.
 * @returns The brain.
 *
 * @example Swimming a koi
 * ```typescript
 * const motion = createKoiMotion({ profile, pond, position, heading, depth })
 * motion.advance(dt)
 * feature.send('outline', motion.outline())
 * ```
 *
 * @example Watching a koi make up its mind
 * ```typescript
 * const motion = createKoiMotion(init, {
 *   onDecision: (decision) => console.log(decision.cause, decision.heading),
 * })
 * ```
 *
 * @example Keeping a koi in the top half of the pond
 * ```typescript
 * const motion = createKoiMotion(init, {
 *   desire: (wanted, context) =>
 *     context.position.y > context.pond.height / 2 ? { heading: -Math.PI / 2, gain: 1, kind: 'avoid' } : wanted,
 * })
 * ```
 */
export function createKoiMotion(init: KoiMotionInit, options: KoiMotionOptions = {}): KoiMotion {
  const { profile } = init
  const { traits, build } = profile
  const seed = koiSeed(profile.framework)
  const trim: KoiMotionTrim = { ...DEFAULT_MOTION_TRIM, ...options.trim }
  const limits: KoiMotionLimits = { ...DEFAULT_MOTION_LIMITS, ...options.limits }
  const { onDecision, desire: override } = options

  let pond = init.pond
  let position = { ...init.position }
  let heading = init.heading
  let depth = init.depth
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

  let lastDecisionS = -trim.decisionIntervalS
  let course = init.heading
  let evasion: { heading: number; gain: number; tier: KoiTurnTierName } | null = null
  let paceScale = 1
  let turnUntilS = 0
  let cooldownUntilS = 0
  let turnDraws = 0
  let turnVelocity = 0

  // why: A side chosen mid-crossing and then re-chosen is the vibration the whole encounter memory exists to stop, so the flank the koi broke toward is held until it has nothing left to avoid.
  let breakSide: -1 | 1 | null = null
  let breakDraws = 0

  // why: The intent report replays decisions the steering ladder otherwise discards: the waypoint behind `course`, the decided side of a depth pass, and which family the current desire came from.
  let travelTarget: Vec2 | null = null
  let depthIntent: { direction: 'above' | 'below'; untilS: number } | null = null
  let committed: { heading: number; kind: 'travel' | 'avoid' } = { heading: init.heading, kind: 'travel' }

  // why: The observer hears decisions, not frames, so a standing intention is reported once rather than sixty times a second.
  let reportedCause: KoiDecisionCause | null = null
  let reportedPass: number | null = null

  // why: This koi's own helm: what its turn trait is worth once the cap that keeps every fish inside a fish's agility has been taken off it.
  const helm = lerp(traits.turnResponsiveness, trim.turnRate) * limits.turnMagnitudeCap

  const bodyLength = (): number => pond.fishLength * build.lengthScale * depthScale(depth)
  const bodyGirth = (): number => bodyLength() * build.girthRatio
  let speed = pond.fishLength * lerp(traits.cruiseSpeed, trim.cruiseBlS)
  let spine = createSpine(position, heading, bodyLength())
  const encounters = createEncounterMemory()
  const pace = createPaceSchedule(seed)
  const itinerary = createItinerary(seed)

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
   * The flank this koi breaks toward for as long as it has something to avoid.
   *
   * Drawn from the water rather than from any one crossing: the koi turns
   * toward whichever side of it is the clearer. When the two read the same, as
   * they do for a pair meeting exactly head-on, a seeded lean to the right
   * settles it, which is what lets both fish of such a pair break the same way
   * and clear each other without exchanging a message.
   *
   * @returns The flank: `1` for the koi's right, `-1` for its left.
   */
  const preferredSide = (): -1 | 1 => {
    if (breakSide !== null) {
      return breakSide
    }
    const crowding = flankCrowding({
      position,
      heading,
      depth,
      reach: pond.fishLength * lerp(traits.awareness, trim.awarenessBl),
      neighbors,
    })
    if (Math.abs(crowding) > trim.sideEvidence) {
      breakSide = crowding > 0 ? -1 : 1
      return breakSide
    }
    breakDraws += 1
    breakSide = randomPseudo(seed + BREAK_DRAWS + breakDraws) < trim.rightBias ? 1 : -1
    return breakSide
  }

  /**
   * Re-forms the koi's judgement: the itinerary leg, the pace, and how every
   * nearby crossing is settled.
   *
   * Runs at its own low cadence rather than every frame, and anchors any
   * evasion as an absolute heading, so a manoeuvre never chases the koi's own
   * moving heading around in a circle.
   */
  const decide = (): void => {
    lastDecisionS = elapsed
    paceScale = 1
    evasion = null
    let urgency = 0
    let breaking = false

    const self = encounterSelf()
    for (const neighbor of neighbors) {
      const resolution = encounters.resolve(self, neighbor, givesWay(profile.framework, neighbor.framework), elapsed, preferredSide)
      if (resolution.action === 'hold') {
        continue
      }
      if (resolution.depth !== null) {
        depthRequest = resolution.depth
        depthIntent = { direction: resolution.action === 'pass-below' ? 'below' : 'above', untilS: elapsed + trim.depthIntentHoldS }
        if (onDecision !== undefined && reportedPass !== resolution.depth) {
          reportedPass = resolution.depth
          onDecision({
            atS: elapsed,
            cause: 'pass',
            kind: 'depth-change',
            heading: null,
            gain: resolution.urgency,
            depth: resolution.depth,
            tier: null,
          })
        }
        continue
      }
      if (resolution.action === 'slow') {
        paceScale = Math.max(0.4, paceScale * (1 - 0.45 * resolution.urgency))
      } else if (resolution.action === 'accelerate') {
        paceScale = Math.min(1.7, paceScale * (1 + 0.5 * resolution.urgency))
      } else {
        breaking = true
        if (resolution.urgency >= urgency) {
          urgency = resolution.urgency
          const side = resolution.turn === -1 ? -1 : 1
          // why: Effort follows how much of it the crossing actually needs, so a distant meeting is settled with a lean and only a close one is worth the whole break.
          const tier = chooseTurnTier(
            { position, heading, speed, neighbor, clearance: encounterClearance(self, neighbor), side },
            trim.evasionTiers,
            trim.tierWindowS
          )
          const committing = trim.evasionTiers[tier]
          evasion = { heading: heading + side * committing.arc, gain: committing.gain, tier }
        }
      }
    }

    // why: The held flank is released only once nothing is left to break for, so the next encounter reads the water afresh instead of inheriting a side chosen for a fish that has already gone past.
    if (!breaking) {
      breakSide = null
    }

    if (shore === 'in') {
      const waypoint = itinerary.current(pond, position, elapsed).point
      course = headingTo(position, waypoint)
      // why: Captured by value, because the itinerary reuses its returned object and the report must not read a mutated leg later.
      travelTarget = { x: waypoint.x, y: waypoint.y }
    }
  }

  /**
   * The heading this koi wants, how hard it is committed to it, and what
   * prompted it.
   *
   * @returns The desired heading, the turn gain to reach it with, its family, its cause, and the effort an avoidance arc commits.
   */
  const wanted = (): KoiDesire & { cause: KoiDecisionCause; tier: KoiTurnTierName | null } => {
    if (threat !== null && elapsed < fleeingUntilS) {
      return {
        heading: headingAwayFrom(position, threat, heading),
        gain: trim.escapeTurnGain,
        kind: 'avoid',
        cause: 'flee',
        tier: null,
      }
    }

    // why: A koi that chose to slip out holds its course, because the whole point of the slip is that the correction was ignored.
    if (shore === 'leaving' || shore === 'away') {
      return { heading, gain: trim.glideGain, kind: 'travel', cause: 'slip', tier: null }
    }

    if (shore === 'returning') {
      // why: The itinerary's course predates the absence; until the koi is back inside, the only sensible pull is open water.
      return { heading: headingTo(position, pondCentre(pond)), gain: 0.5, kind: 'travel', cause: 'return', tier: null }
    }

    const edge = boundaryPressure(pond, position, heading)
    // why: Engage and release at different urgencies, because a single threshold flickers the correction on and off at the margin, and that flicker is the left-right-left vibration.
    if (!boundaryEngaged && edge.urgency > trim.boundaryEngage) {
      boundaryEngaged = true
      crossings += 1
      if (slipsAway(seed, crossings)) {
        shore = 'leaving'
        return { heading, gain: trim.glideGain, kind: 'travel', cause: 'slip', tier: null }
      }
      // why: The itinerary must not keep pulling at the wall the koi is being pushed off, so the next leg starts from open water.
      itinerary.abandon()
    } else if (boundaryEngaged && edge.urgency < trim.boundaryRelease) {
      boundaryEngaged = false
    }
    if (boundaryEngaged) {
      const caution = 0.4 + traits.directionalCaution * 0.6
      cooldownUntilS = Math.max(cooldownUntilS, elapsed + 1)
      return {
        heading: Math.atan2(edge.inward.y, edge.inward.x),
        gain: 1 + edge.urgency * caution * 1.4,
        kind: 'avoid',
        cause: 'boundary',
        tier: null,
      }
    }

    if (evasion !== null) {
      cooldownUntilS = Math.max(cooldownUntilS, elapsed + 1)
      return { heading: evasion.heading, gain: evasion.gain, kind: 'avoid', cause: 'evade', tier: evasion.tier }
    }

    const damping = pond.reducedMotion ? trim.reducedMotionDamping : 1
    const ripple = wanderOffset(seed, elapsed) * trim.wanderRipple * damping
    const error = wrapAngle(course - heading)
    const finish = (): void => {
      // why: However a turn ends, course reached or clock expired, its cooldown starts, so turns come as separate events rather than a continuous correction.
      turnUntilS = 0
      turnDraws += 1
      cooldownUntilS = elapsed + lerp(wanderOffset(seed + 7, turnDraws * 13) * 0.5 + 0.5, trim.turnCooldownS)
    }
    if (turnUntilS !== 0) {
      if (elapsed >= turnUntilS || Math.abs(error) < 0.06) {
        finish()
        return { heading: course + ripple, gain: trim.glideGain, kind: 'travel', cause: 'glide', tier: null }
      }
      return { heading: course, gain: 1, kind: 'travel', cause: 'turn', tier: null }
    }
    if (Math.abs(error) > trim.turnTrigger && elapsed > cooldownUntilS) {
      turnUntilS = elapsed + Math.min(trim.turnMaxS, Math.abs(error) / lerp(traits.turnResponsiveness, trim.turnRate) + 0.3)
      return { heading: course, gain: 1, kind: 'travel', cause: 'turn', tier: null }
    }
    return { heading: course + ripple, gain: trim.glideGain, kind: 'travel', cause: 'glide', tier: null }
  }

  /**
   * The speed this koi is aiming for right now, in pixels per second.
   *
   * @param helmLoad - How much of its helm the koi currently has wound on, 0 to 1.
   * @returns The target speed.
   */
  const targetSpeed = (helmLoad: number): number => {
    if (shore === 'away') {
      return 0
    }
    // why: A hard ceiling over every band and multiplier, so whatever pace events and give-way scales stack, no koi ever flies across the pond.
    const cap = pond.fishLength * limits.maxSpeedBlS
    const damping = pond.reducedMotion ? trim.reducedMotionDamping : 1
    if (elapsed < fleeingUntilS) {
      // why: A bolt is not braked for its own turns: what its speed costs is the helm itself, charged once by `turnSpeedTax`, and charging it again here is what would leave an escape reading as a shrug.
      return Math.min(cap, pond.fishLength * lerp(traits.reactionIntensity, trim.escapeBlS) * damping)
    }
    // why: The trait sets this koi's own cruise; the pace schedule loafs and hurries it in bounded, exclusive events; an encounter's give-way scales ride on top.
    const cruising = Math.min(cap, pond.fishLength * lerp(traits.cruiseSpeed, trim.cruiseBlS) * pace.multiplier(elapsed) * paceScale)
    // why: A koi brakes into the turn it committed to and comes back onto its pace out of it, which is what stops a manoeuvre reading as a drift taken at cruise.
    return cruising * (1 - helmLoad * trim.turnBrake)
  }

  /**
   * Everything outside the integrator that one step of this koi's flight turns
   * on.
   *
   * @param aim - The rule the koi steers by.
   * @returns The terms to step with.
   */
  const flightTerms = (aim: KoiMotionAim): KoiFlightTerms => ({
    aim,
    helm,
    targetSpeed,
    moves: shore !== 'away',
    fishLength: pond.fishLength,
    cruiseCeilingBlS: trim.cruiseBlS.max,
    speedEase: trim.speedEase,
    accelLimitBlS2: limits.accelLimitBlS2,
    turnAccel: limits.turnAccel,
    turnApproach: limits.turnApproach,
    turnSpeedTax: limits.turnSpeedTax,
  })

  /**
   * The koi's current decision, told as the host's overlay wants it: a family,
   * a steering target, and how far ahead this koi is anticipating.
   *
   * An avoidance projects along the desired escape heading, the trajectory the
   * manoeuvre decided on, while ordinary travel points at the real itinerary
   * waypoint. A decided depth pass is vertical, so it carries a direction
   * instead of a point; it stays readable while the roll it started plays out,
   * unless a horizontal avoidance takes over the story.
   *
   * @returns The intent report.
   */
  const intent = (): KoiIntent => {
    // how: The self-sized reading of the pairwise encounter window: how far this koi closes in one anticipation horizon, plus the clearance it keeps for itself.
    const reachPx = speed * ENCOUNTER_HORIZON_S + bodyLength() * ENCOUNTER_CLEARANCE + bodyGirth() * 2
    if (committed.kind === 'avoid') {
      return {
        kind: 'avoid',
        target: { x: position.x + Math.cos(committed.heading) * reachPx, y: position.y + Math.sin(committed.heading) * reachPx },
        reachPx,
      }
    }
    if (depthIntent !== null && elapsed < depthIntent.untilS) {
      return { kind: 'depth-change', target: null, direction: depthIntent.direction, reachPx }
    }
    const target =
      shore === 'in' && travelTarget !== null
        ? { x: travelTarget.x, y: travelTarget.y }
        : { x: position.x + Math.cos(heading) * reachPx, y: position.y + Math.sin(heading) * reachPx }
    return { kind: 'travel', target, reachPx }
  }

  return {
    advance(dt) {
      // why: The clock this frame started from, because the step reads its judgement at the moment it lands on rather than the one it left.
      const startedAtS = elapsed
      elapsed += dt

      if (shore === 'leaving') {
        const bounds = pondBounds(pond)
        const clearance = bodyLength() * trim.exitClearanceBl
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

      if (elapsed - lastDecisionS >= trim.decisionIntervalS) {
        decide()
      }

      const formed = wanted()
      const cause = formed.cause
      const wants =
        override === undefined
          ? formed
          : override(
              { heading: formed.heading, gain: formed.gain, kind: formed.kind },
              {
                atS: elapsed,
                cause,
                position: { x: position.x, y: position.y },
                heading,
                speed,
                depth,
                pond,
              }
            )
      committed = { heading: wants.heading, kind: wants.kind }
      if (onDecision !== undefined && cause !== reportedCause) {
        reportedCause = cause
        onDecision({ atS: elapsed, cause, kind: wants.kind, heading: wants.heading, gain: wants.gain, depth: null, tier: formed.tier })
      }
      // why: Every koi frame steps through the shared integrator, so the arithmetic that carries a koi forward has one home and cannot be quietly reimplemented beside it.
      const held: KoiMotionAim = () => ({ heading: wants.heading, gain: wants.gain })
      const flown = stepFlight({ position, heading, speed, turnVelocity, atS: startedAtS }, flightTerms(held), dt)
      position = flown.position
      heading = flown.heading
      speed = flown.speed
      turnVelocity = flown.turnVelocity

      const turnedBy = Math.abs(turnVelocity)
      if (elapsed < transitioningUntilS) {
        phase = 'depth-transition'
      } else if (elapsed < fleeingUntilS) {
        phase = 'escape'
      } else if (turnedBy > trim.turningEnter || (phase === 'turning' && turnedBy > trim.turningExit)) {
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
      reportedPass = null
      // why: The roll between levels is a visible state of its own, so the body reads as changing depth rather than merely resizing.
      transitioningUntilS = elapsed + trim.depthRollS
    },

    startle(disturbance) {
      const reach = pond.fishLength * lerp(traits.awareness, trim.awarenessBl)
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
      fleeingUntilS = elapsed + lerp(traits.reactionIntensity, trim.escapeS) * (0.6 + felt * 0.6)
      return true
    },

    observe(next) {
      neighbors = next
    },

    place(point) {
      const from = position
      position = { x: point.x, y: point.y }
      const step = Math.hypot(position.x - from.x, position.y - from.y)
      if (step > trim.placeLeadMinPx) {
        // why: The body leans toward where it is being led at a rate a held fish could actually muster, because the mesh must never whip around under the visitor's hand.
        heading = turnToward(heading, headingTo(from, position), trim.placeLeanRad)
      }
      // why: Everything the grab interrupted is dropped, because a stale flee, evasion, or scheduled turn resuming at the drop point is exactly the lunge a released fish must not make.
      turnVelocity = 0
      threat = null
      fleeingUntilS = 0
      evasion = null
      breakSide = null
      boundaryEngaged = false
      turnUntilS = 0
      travelTarget = null
      depthIntent = null
      committed = { heading, kind: 'travel' }
      reportedPass = null
      shore = 'in'
      itinerary.abandon()
      course = heading
      cooldownUntilS = Math.max(cooldownUntilS, elapsed + trim.placeSettleS)
      speed = Math.min(speed, pond.fishLength * lerp(traits.cruiseSpeed, trim.cruiseBlS))
      // why: The spine trails the carried nose through the drag path, so the outline the host hit-tests keeps matching the body a visitor is holding.
      spine = advanceSpine(spine, {
        nose: position,
        length: bodyLength(),
        speed: 0,
        phase: 'relaxed',
        dt: trim.placeFollowS,
        reducedMotion: pond.reducedMotion,
      })
    },

    get state() {
      return { position, heading, speed, turnVelocity, phase, depth, length: bodyLength(), spine }
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
        intent: intent(),
      }
    },

    takeDepthRequest() {
      const requested = depthRequest
      depthRequest = null
      return requested
    },
  }
}
