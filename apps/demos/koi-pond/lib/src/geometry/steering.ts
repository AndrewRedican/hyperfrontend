/**
 * Steering primitives and the narrow-phase encounter resolver.
 *
 * These are the verbs every koi steers with — they are deliberately *not* a
 * swimming brain. Each fish app composes them into its own loop, with its own
 * weighting and its own idea of what a relaxed cruise feels like; eight
 * independent compositions over one shared vocabulary is what the pond is
 * demonstrating.
 *
 * The one piece of shared judgement is {@link resolveEncounter}: two koi must
 * agree on how a crossing is settled, or they will both dodge the same way.
 */
import type { KoiTraits, NeighborObservation, Vec2 } from '../model/types.js'
import { PASSING_SEPARATION } from '../model/depth.js'

/** How many seconds ahead the narrow phase looks for a closest approach. */
export const ENCOUNTER_HORIZON_S = 2.4

/** How close two koi may come, as a fraction of the larger body length, before it counts as an encounter. */
export const ENCOUNTER_CLEARANCE = 0.55

/**
 * Folds an angle into `[-PI, PI]`.
 *
 * @param radians - Any angle.
 * @returns The equivalent angle in the principal range.
 */
export function wrapAngle(radians: number): number {
  const wrapped = (radians + Math.PI) % (Math.PI * 2)
  return (wrapped < 0 ? wrapped + Math.PI * 2 : wrapped) - Math.PI
}

/**
 * Turns a heading toward another, never faster than the koi can turn.
 *
 * @param heading - The current heading in radians.
 * @param desired - The heading to turn toward.
 * @param maxTurn - The largest turn allowed this frame, in radians.
 * @returns The new heading.
 *
 * @example Easing onto a new course
 * ```typescript
 * heading = turnToward(heading, Math.atan2(away.y, away.x), turnRate * dt)
 * ```
 */
export function turnToward(heading: number, desired: number, maxTurn: number): number {
  const delta = wrapAngle(desired - heading)
  const limit = Math.abs(maxTurn)
  return wrapAngle(heading + (delta > limit ? limit : delta < -limit ? -limit : delta))
}

/**
 * The heading that points from one place to another.
 *
 * @param from - Where the koi is.
 * @param to - Where it wants to be.
 * @returns The heading in radians.
 */
export function headingTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x)
}

/**
 * The heading directly away from a threat.
 *
 * @param position - The koi's nose.
 * @param threat - What it is fleeing.
 * @param fallback - The heading to keep when the koi sits exactly on the threat.
 * @returns The heading in radians.
 */
export function headingAwayFrom(position: Vec2, threat: Vec2, fallback: number): number {
  const dx = position.x - threat.x
  const dy = position.y - threat.y
  // why: A strike landing exactly on the nose has no away-direction; holding course beats spinning on a divide-by-zero.
  return dx === 0 && dy === 0 ? fallback : Math.atan2(dy, dx)
}

/**
 * A slow, wandering drift for a koi with nothing better to do.
 *
 * Two detuned sines beat against each other, so the course never repeats on a
 * period a visitor can spot.
 *
 * @param seed - The koi's stable seed, so no two wander in step.
 * @param elapsedS - Seconds since the pond opened.
 * @returns A heading offset in radians, roughly `[-1, 1]` scaled by amplitude.
 */
export function wanderOffset(seed: number, elapsedS: number): number {
  // magic: 0.11 and 0.067 rad/s are close enough to beat slowly and far enough apart never to phase-lock.
  return Math.sin(elapsedS * 0.11 + seed) * 0.62 + Math.sin(elapsedS * 0.067 + seed * 1.7) * 0.38
}

/** When and how near two koi will come to each other if neither changes course. */
export interface ClosestApproach {
  /** Seconds until the closest approach; 0 when they are already closing at their nearest. */
  timeS: number
  /** How far apart their noses will be at that moment, in CSS pixels. */
  distance: number
}

/**
 * Predicts the closest approach of two koi holding their present courses.
 *
 * @param position - The koi's nose.
 * @param velocity - The koi's velocity in pixels per second.
 * @param otherPosition - The neighbour's nose.
 * @param otherVelocity - The neighbour's velocity in pixels per second.
 * @returns When and how near they will pass.
 *
 * @example Looking ahead before committing to a course
 * ```typescript
 * const approach = closestApproach(nose, velocity, other.nose, other.velocity)
 * const willCollide = approach.timeS < ENCOUNTER_HORIZON_S && approach.distance < clearance
 * ```
 */
export function closestApproach(position: Vec2, velocity: Vec2, otherPosition: Vec2, otherVelocity: Vec2): ClosestApproach {
  const px = otherPosition.x - position.x
  const py = otherPosition.y - position.y
  const vx = otherVelocity.x - velocity.x
  const vy = otherVelocity.y - velocity.y
  const closingSpeedSquared = vx * vx + vy * vy
  // why: Two koi on identical courses never converge; reporting the present gap at t=0 keeps the caller from acting on a meaningless prediction.
  if (closingSpeedSquared === 0) {
    return { timeS: 0, distance: Math.hypot(px, py) }
  }
  const raw = -(px * vx + py * vy) / closingSpeedSquared
  const timeS = raw < 0 ? 0 : raw
  return { timeS, distance: Math.hypot(px + vx * timeS, py + vy * timeS) }
}

/** What a koi decides to do about a neighbour it is closing on. */
export type EncounterAction = 'hold' | 'turn' | 'slow' | 'accelerate' | 'pass-above' | 'pass-below'

/** A resolved encounter: what to do, and which way. */
export interface EncounterResolution {
  /** The manoeuvre to make. */
  action: EncounterAction
  /** Which way to turn: `1` swings the heading clockwise on screen (toward the right flank), `-1` the other way; `0` when the action does not turn. */
  turn: -1 | 0 | 1
  /** The depth level to ask the host for, or `null` when the manoeuvre stays at this depth. */
  depth: number | null
  /** How firmly to commit, 0 to 1 — how close the encounter is against the clearance it needs. */
  urgency: number
}

/** Everything the resolver needs to know about the koi doing the deciding. */
export interface EncounterSelf {
  /** Its nose in pond space. */
  position: Vec2
  /** Its heading in radians. */
  heading: number
  /** Its speed in pixels per second. */
  speed: number
  /** Its depth level. */
  depth: number
  /** Its nose-to-tail length in CSS pixels. */
  length: number
  /** Its widest half-width in CSS pixels, so a heavier build claims more water. */
  girth: number
  /** Its traits, which decide how boldly it resolves. */
  traits: KoiTraits
}

/**
 * Decides how one koi settles a crossing with another.
 *
 * Two koi separated by {@link PASSING_SEPARATION} levels or more simply pass —
 * that is the whole point of the depth model, and it is checked first so most
 * encounters cost nothing. Otherwise the koi looks ahead: a crossing it will not
 * actually make is held, and one it will is resolved by changing depth (if it is
 * the sort of fish that does), by turning aside, or — when the two are running
 * the same way and a turn would be absurd — by easing off or pushing on.
 *
 * The tie is broken on framework slug order rather than on geometry, so both
 * koi in a pair reach opposite conclusions without exchanging a message.
 *
 * @param self - The koi deciding.
 * @param neighbor - The koi it is closing on.
 * @param tieBreak - `true` when this koi takes the "give way" side of the pair.
 * @returns The manoeuvre to make.
 */
export function resolveEncounter(self: EncounterSelf, neighbor: NeighborObservation, tieBreak: boolean): EncounterResolution {
  const held: EncounterResolution = { action: 'hold', turn: 0, depth: null, urgency: 0 }
  if (Math.abs(self.depth - neighbor.depth) >= PASSING_SEPARATION) {
    return held
  }

  const velocity = { x: Math.cos(self.heading) * self.speed, y: Math.sin(self.heading) * self.speed }
  const otherVelocity = { x: Math.cos(neighbor.heading) * neighbor.speed, y: Math.sin(neighbor.heading) * neighbor.speed }
  const approach = closestApproach(self.position, velocity, { x: neighbor.x, y: neighbor.y }, otherVelocity)
  // why: The girths ride on top of the length term so two broad koi claim more water than two slender ones of the same length — clearance has to follow the bodies actually in the water.
  const clearance = Math.max(self.length, neighbor.length) * ENCOUNTER_CLEARANCE + self.girth + neighbor.girth

  if (approach.timeS > ENCOUNTER_HORIZON_S || approach.distance > clearance) {
    return held
  }

  const urgency = Math.max(0, Math.min(1, 1 - approach.distance / clearance))
  const bearing = wrapAngle(headingTo(self.position, { x: neighbor.x, y: neighbor.y }) - self.heading)
  const courseDelta = Math.abs(wrapAngle(neighbor.heading - self.heading))
  // why: The koi turns away from where the neighbour actually is; a neighbour dead ahead is broken toward this fish's left so the pair splits.
  const turn: -1 | 1 = bearing === 0 ? 1 : bearing > 0 ? -1 : 1

  const willingness = self.traits.depthWillingness
  if (willingness > 0.5 && urgency > 0.35) {
    // why: Only one of the pair changes depth — if both dive they simply meet again a level down.
    const goDeeper = tieBreak
    const target = goDeeper ? self.depth - PASSING_SEPARATION : self.depth + PASSING_SEPARATION
    return { action: goDeeper ? 'pass-below' : 'pass-above', turn: 0, depth: target, urgency }
  }

  // magic: A quarter-turn of course difference is the line between "running together" and "crossing"; overtaking is settled with speed, crossing with a turn.
  if (courseDelta < Math.PI / 4) {
    const ahead = Math.abs(bearing) < Math.PI / 2
    return { action: ahead ? 'slow' : 'accelerate', turn: 0, depth: null, urgency }
  }

  return { action: 'turn', turn, depth: null, urgency }
}

/**
 * Whether this koi takes the give-way side of a pair.
 *
 * Ordering on the framework slug makes both koi agree without a round trip: the
 * one whose slug sorts first gives way, every time, in both frames.
 *
 * @param self - This koi's framework slug.
 * @param other - The neighbour's framework slug.
 * @returns `true` when this koi gives way.
 */
export function givesWay(self: string, other: string): boolean {
  return self < other
}

/** Seconds an encounter's chosen manoeuvre survives after the geometry stops demanding it. */
const ENCOUNTER_HOLD_S = 0.9

/** The urgency a latched turn tails off at while the geometry no longer demands it. */
const TURN_TAIL_URGENCY = 0.18

/**
 * Per-neighbour memory that keeps an avoidance manoeuvre committed.
 *
 * {@link resolveEncounter} re-reads the geometry every frame, and near the
 * crossing point both the bearing's side and the manoeuvre's *kind* can flip
 * frame to frame — a crossing near the quarter-turn line flickers between
 * `turn` and `slow`, and either flicker steered raw reads as a fish vibrating
 * between two corrections. The memory latches the first manoeuvre chosen
 * against each neighbour: a turn keeps its side and, once the geometry clears,
 * tails off gently instead of snapping straight; a slow or an accelerate keeps
 * its kind until the encounter has actually been over for a moment.
 */
export interface EncounterMemory {
  /**
   * Resolves an encounter, holding it to the manoeuvre first chosen.
   *
   * @param self - The koi deciding.
   * @param neighbor - The koi it is closing on.
   * @param tieBreak - `true` when this koi takes the give-way side of the pair.
   * @param nowS - The koi's own clock, in seconds.
   * @returns The manoeuvre to make, stable across the crossing.
   */
  resolve(self: EncounterSelf, neighbor: NeighborObservation, tieBreak: boolean, nowS: number): EncounterResolution
}

/**
 * Creates the per-neighbour encounter memory for one koi's brain.
 *
 * @returns The memory, empty until the first close encounter.
 *
 * @example Steering through a crossing without flip-flopping
 * ```typescript
 * const encounters = createEncounterMemory()
 * const resolution = encounters.resolve(self, neighbor, givesWay(me, neighbor.framework), elapsedS)
 * ```
 */
export function createEncounterMemory(): EncounterMemory {
  const held = new Map<string, { action: 'turn' | 'slow' | 'accelerate'; turn: -1 | 0 | 1; untilS: number }>()

  return {
    resolve(self, neighbor, tieBreak, nowS) {
      const resolution = resolveEncounter(self, neighbor, tieBreak)
      const memory = held.get(neighbor.framework)
      const remembered = memory !== undefined && nowS <= memory.untilS ? memory : undefined
      if (memory !== undefined && remembered === undefined) {
        held.delete(neighbor.framework)
      }

      if (remembered === undefined) {
        if (resolution.action === 'turn') {
          const turn = resolution.turn === 0 ? 1 : resolution.turn
          held.set(neighbor.framework, { action: 'turn', turn, untilS: nowS + ENCOUNTER_HOLD_S })
          return turn === resolution.turn ? resolution : { ...resolution, turn }
        }
        if (resolution.action === 'slow' || resolution.action === 'accelerate') {
          held.set(neighbor.framework, { action: resolution.action, turn: 0, untilS: nowS + ENCOUNTER_HOLD_S })
        }
        return resolution
      }

      // why: The committed manoeuvre wins for its whole hold — near the crossing the raw kind and side both flip frame to frame, and honouring any of those flips is exactly the vibration being suppressed. An encounter the manoeuvre genuinely fails to settle outlives the hold and escalates then.
      if (resolution.action === remembered.action) {
        held.set(neighbor.framework, { action: remembered.action, turn: remembered.turn, untilS: nowS + ENCOUNTER_HOLD_S })
        return remembered.action === 'turn' && resolution.turn !== remembered.turn ? { ...resolution, turn: remembered.turn } : resolution
      }

      // why: A manoeuvre the geometry no longer demands tails off gently instead of snapping away; one it still demands keeps its felt urgency.
      const urgency = resolution.action === 'hold' ? TURN_TAIL_URGENCY : resolution.urgency
      return { action: remembered.action, turn: remembered.turn, depth: null, urgency }
    },
  }
}
