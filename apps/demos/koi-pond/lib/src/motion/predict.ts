/**
 * The integrator a koi's flight runs through.
 *
 * One step of flight is a fixed sequence: the helm winds toward the rate the
 * remaining course error asks for, the heading follows the rate the koi now
 * carries, the pace eases toward its target under a hard acceleration bound, and
 * the nose travels along the heading it has just taken. Nothing about the step
 * belongs to any one caller, so every koi frame is stepped here and the
 * arithmetic exists in one place.
 *
 * The pull among the terms is a rule rather than a number, read afresh at each
 * step, because most of what a koi steers by is a bearing taken from wherever it
 * has got to: away from what struck the water, off the shore it is closing on,
 * onto the waypoint it is crossing the pond for. A caller with a settled pull
 * hands back the same one every step; a caller working out a flight the koi has
 * not taken yet gets the koi's own judgement re-formed at every position.
 */
import type { Vec2 } from '../model/types.js'
import { wrapAngle } from '../geometry/steering.js'

/** Where a koi is, where it is pointed, and what it carries into its next step. */
export interface KoiFlight {
  /** Its nose in pond space. */
  position: Vec2
  /** Its heading in radians. */
  heading: number
  /** Its speed in pixels per second. */
  speed: number
  /** The turn rate it has wound up, in radians per second, positive toward its right flank. */
  turnVelocity: number
  /** The koi's own accumulated clock at the start of the step, in seconds. */
  atS: number
}

/** The pull a koi is steering by: where it wants to be pointed, and how hard it is committed to getting there. */
export interface KoiFlightAim {
  /** The heading to steer toward, in radians. */
  heading: number
  /** The multiplier on the koi's own turn rate while it steers there. */
  gain: number
}

/** What a koi's judgement and its world contribute to one step of flight. */
export interface KoiFlightTerms {
  /**
   * The pull the koi steers by from a given flight.
   *
   * Read at the clock the step lands on rather than the one it left, because a
   * koi forms its judgement for the frame it is about to swim.
   *
   * @param position - The nose the pull is taken from, in pond space.
   * @param heading - The heading it is taken from, in radians.
   * @param atS - The koi's own clock at the moment the pull is read, in seconds.
   * @returns The pull.
   */
  aim(position: Vec2, heading: number, atS: number): KoiFlightAim
  /** The koi's own turn ceiling at a relaxed cruise, in radians per second, with its magnitude cap already taken off it. */
  helm: number
  /**
   * The speed the koi is aiming for, in pixels per second.
   *
   * @param helmLoad - How much of its helm the koi has wound on, 0 to 1.
   * @returns The target speed.
   */
  targetSpeed(helmLoad: number): number
  /** Whether the nose actually travels: a koi that has slipped out of the pond is somewhere else entirely. */
  moves: boolean
  /** The world's nominal fish length in CSS pixels, which every body-length term is measured in. */
  fishLength: number
  /** The cruise pace past which speed starts taxing the helm, in body lengths per second. */
  cruiseCeilingBlS: number
  /** How quickly speed eases toward its target, as a fraction closed per second. */
  speedEase: number
  /** The hardest the koi can accelerate or brake, in body lengths per second squared. */
  accelLimitBlS2: number
  /** How hard the koi can wind its turn rate up or down, in radians per second squared. */
  turnAccel: number
  /** How firmly remaining course error asks for turn rate, per second: the ramp-out of every turn. */
  turnApproach: number
  /** How much swimming past cruise pace taxes the helm, per body length per second of excess. */
  turnSpeedTax: number
}

/**
 * Advances one step of flight.
 *
 * Pure: the given flight is read, never written, and the step returned carries a
 * position of its own, so the same starting flight can be stepped repeatedly to
 * integrate a stretch of swimming forward.
 *
 * @param flight - Where the koi is and what it carries into the step.
 * @param terms - What its judgement and its world contribute.
 * @param dt - The step, in seconds.
 * @returns The flight one step later.
 *
 * @example Advancing a frame
 * ```typescript
 * const next = stepFlight({ position, heading, speed, turnVelocity, atS }, terms, dt)
 * ```
 */
export function stepFlight(flight: KoiFlight, terms: KoiFlightTerms, dt: number): KoiFlight {
  const atS = flight.atS + dt
  const aim = terms.aim(flight.position, flight.heading, atS)
  const error = wrapAngle(aim.heading - flight.heading)
  // why: Speed taxes the helm, because a koi past cruise pace physically cannot carve a tight arc, so a bolting fish sweeps through a wide curve instead of pivoting at full speed.
  const overCruise = Math.max(0, flight.speed / terms.fishLength - terms.cruiseCeilingBlS)
  const ceiling = (terms.helm * aim.gain) / (1 + overCruise * terms.turnSpeedTax)
  // why: Rate follows the remaining error down, so every turn ramps out as the course closes instead of holding full curvature to the last degree and stopping dead.
  const desired = Math.max(-ceiling, Math.min(ceiling, error * terms.turnApproach))
  // why: The turn rate is a state with bounded acceleration, never a step, so the body winds into and out of each manoeuvre and conflicting pulls are damped by inertia instead of alternating sides frame to frame.
  const windup = terms.turnAccel * dt
  const turnVelocity = flight.turnVelocity + Math.max(-windup, Math.min(windup, desired - flight.turnVelocity))
  const heading = wrapAngle(flight.heading + turnVelocity * dt)

  // why: The exponential ease still shapes small adjustments, but the hard bound is what keeps a startled koi surging up to speed over a beat or two rather than leaping to it.
  const accelLimit = terms.fishLength * terms.accelLimitBlS2 * dt
  // how: The brake is charged against the koi's own helm rather than against whatever gain this step asked for, so a glide's nudge costs it nothing and a committed break costs it the lot.
  const eased = (terms.targetSpeed(Math.min(1, Math.abs(turnVelocity) / terms.helm)) - flight.speed) * Math.min(1, terms.speedEase * dt)
  const speed = flight.speed + Math.max(-accelLimit, Math.min(accelLimit, eased))

  const position = terms.moves
    ? { x: flight.position.x + Math.cos(heading) * speed * dt, y: flight.position.y + Math.sin(heading) * speed * dt }
    : { x: flight.position.x, y: flight.position.y }
  return { position, heading, speed, turnVelocity, atS }
}
