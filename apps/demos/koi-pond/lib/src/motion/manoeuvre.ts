/**
 * The shape of an avoidance: which flank a koi breaks toward, and how much
 * effort it commits to getting past.
 *
 * Both readings sit deliberately outside the pairwise encounter resolver. The
 * resolver settles one crossing at a time and knows only the two koi in it;
 * these read the water the koi is actually swimming through, which is what
 * decides whether a lean is enough and which side of the pond is clear.
 */
import type { ClosestApproach } from '../geometry/steering.js'
import type { NeighborObservation, Vec2 } from '../model/types.js'
import { ENCOUNTER_HORIZON_S, closestApproach, wrapAngle } from '../geometry/steering.js'
import { PASSING_SEPARATION } from '../model/depth.js'

/** How much effort a manoeuvre commits. */
export type KoiTurnTierName = 'subtle' | 'normal' | 'hard'

/** What one tier of manoeuvre commits to. */
export interface KoiTurnTier {
  /** The heading change it swings through, in radians. */
  arc: number
  /** The multiplier on the koi's turn rate while it swings there. */
  gain: number
}

/** The three tiers every avoidance is drawn from, from the least effort to the most. */
export interface KoiTurnTiers {
  /** A lazy lean, for a crossing that is still a long way off. */
  subtle: KoiTurnTier
  /** An ordinary break. */
  normal: KoiTurnTier
  /** A committed break, for an obstacle that is genuinely close. */
  hard: KoiTurnTier
}

/** How near an encounter has to be, in seconds to the closest approach, before each tier is permitted. */
export interface KoiTurnTierWindows {
  /** Inside this many seconds the hard tier is permitted. */
  hardS: number
  /** Inside this many seconds the normal tier is permitted. */
  normalS: number
}

/** What a koi can see of the water it is deciding in. */
export interface KoiFlankField {
  /** The koi's nose in pond space. */
  position: Vec2
  /** Its heading in radians. */
  heading: number
  /** Its depth level. */
  depth: number
  /** How far it notices things, in CSS pixels. */
  reach: number
  /** The koi close enough to have been relayed to it. */
  neighbors: readonly NeighborObservation[]
}

/** The crossing a manoeuvre has to settle. */
export interface KoiCrossing {
  /** The koi's nose in pond space. */
  position: Vec2
  /** Its heading in radians. */
  heading: number
  /** Its speed in pixels per second. */
  speed: number
  /** The neighbour it is closing on. */
  neighbor: NeighborObservation
  /** How far apart the pair has to stay, in CSS pixels. */
  clearance: number
  /** The flank it breaks toward: `1` for its right, `-1` for its left. */
  side: -1 | 1
}

/**
 * Reads which of a koi's flanks the water is busier on.
 *
 * Every neighbour votes with how near it is and how squarely it sits ahead: one
 * off the beam or astern is not in the way, and one dead ahead says nothing
 * about which side to pass it on. A neighbour a passing separation away in
 * depth is not an obstacle at all.
 *
 * @param field - Where the koi is, how far it notices, and who is near it.
 * @returns The crowding: positive when the right flank is the busier one, and 0 when the evidence is even.
 *
 * @example Breaking toward the clearer water
 * ```typescript
 * const crowding = flankCrowding({ position, heading, depth, reach, neighbors })
 * const side = crowding > 0 ? -1 : 1
 * ```
 */
export function flankCrowding(field: KoiFlankField): number {
  let crowding = 0
  for (const neighbor of field.neighbors) {
    if (Math.abs(field.depth - neighbor.depth) >= PASSING_SEPARATION) {
      continue
    }
    const dx = neighbor.x - field.position.x
    const dy = neighbor.y - field.position.y
    const distance = Math.hypot(dx, dy)
    if (distance >= field.reach) {
      continue
    }
    const bearing = wrapAngle(Math.atan2(dy, dx) - field.heading)
    // how: Nearness weights the vote, the forward term drops everything abeam and astern, and the sine is the side itself.
    crowding += (1 - distance / field.reach) * Math.max(0, Math.cos(bearing)) * Math.sin(bearing)
  }
  return crowding
}

/**
 * The velocity of a body on a heading.
 *
 * @param heading - The heading in radians.
 * @param speed - The speed in pixels per second.
 * @returns The velocity vector.
 */
function velocityOf(heading: number, speed: number): Vec2 {
  return { x: Math.cos(heading) * speed, y: Math.sin(heading) * speed }
}

/**
 * How near the pair comes if the koi holds a candidate heading.
 *
 * @param crossing - The crossing being settled.
 * @param heading - The heading to test, in radians.
 * @returns When and how near they would pass.
 */
function approachOn(crossing: KoiCrossing, heading: number): ClosestApproach {
  const { neighbor } = crossing
  return closestApproach(
    crossing.position,
    velocityOf(heading, crossing.speed),
    { x: neighbor.x, y: neighbor.y },
    velocityOf(neighbor.heading, neighbor.speed)
  )
}

/**
 * Whether swinging through an arc carries the koi clear of the crossing.
 *
 * @param crossing - The crossing being settled.
 * @param arc - The heading change to test, in radians.
 * @returns `true` when the pair keeps its clearance.
 */
function clears(crossing: KoiCrossing, arc: number): boolean {
  // how: The candidate is judged along the heading the arc lands on, which reads the manoeuvre at its most optimistic; a koi swings onto it over a beat rather than instantly, and the ladder is re-climbed every decision while it does.
  const approach = approachOn(crossing, crossing.heading + crossing.side * arc)
  return approach.timeS > ENCOUNTER_HORIZON_S || approach.distance >= crossing.clearance
}

/**
 * Picks the least effort that settles a crossing.
 *
 * Proximity sets the ceiling: a crossing still a long way off is worth no more
 * than a lean however poorly the lean clears it, and only one nearly upon the
 * koi unlocks the hard tier. Under that ceiling the ladder is climbed from the
 * bottom, so what the koi commits to is the smallest arc that predicts a clean
 * pass rather than the largest one it is allowed.
 *
 * @param crossing - The crossing being settled, and the flank being broken toward.
 * @param tiers - The three tiers to choose between.
 * @param windows - How near the crossing has to be for each tier to be permitted.
 * @returns The tier to commit.
 *
 * @example Committing the arc a crossing actually needs
 * ```typescript
 * const tier = chooseTurnTier(crossing, trim.evasionTiers, trim.tierWindowS)
 * const heading = state.heading + crossing.side * trim.evasionTiers[tier].arc
 * ```
 */
export function chooseTurnTier(crossing: KoiCrossing, tiers: KoiTurnTiers, windows: KoiTurnTierWindows): KoiTurnTierName {
  const approach = approachOn(crossing, crossing.heading)
  if (approach.timeS > windows.normalS || clears(crossing, tiers.subtle.arc)) {
    return 'subtle'
  }
  if (approach.timeS > windows.hardS || clears(crossing, tiers.normal.arc)) {
    return 'normal'
  }
  return 'hard'
}
