/**
 * Scheduled behaviour: the seeded event streams a koi's brain draws from.
 *
 * These are verbs, not a brain. A koi's pace changes, its itinerary across the
 * pond, and its occasional decision to slip out past the boundary are all
 * *discrete, scheduled events* rather than continuous noise: an event begins,
 * runs its bounded course, and ends before another may start. Everything is
 * seeded through `randomPseudo`, so the same koi lives the same life on every
 * reload and none of the fish apps needs to exchange a message about it.
 *
 * Each fish app composes these verbs with its own thresholds and priorities;
 * the shared part is only the vocabulary and the determinism.
 */
import { randomPseudo } from '@hyperfrontend/random-generator-utils'
import type { PondEnvironment, Vec2 } from '../model/types.js'
import { pondBounds } from './virtual-pond.js'

/** Where the pace schedule's draw band starts on the koi's seed. */
const PACE_DRAWS = 60

/** Where the itinerary's draw band starts on the koi's seed. */
const ITINERARY_DRAWS = 200

/** Where the shoreline-crossing draw band starts on the koi's seed. */
const SHORE_DRAWS = 400

/** Seconds of plain cruising between two pace events. */
const PACE_REST_S = { min: 6, max: 14 }

/** The three pace events a koi schedules, with their bands. */
const PACE_EVENTS = <const>[
  // why: Loafing is the most common change a pond visitor should see — real koi spend most of their slow time drifting, not sprinting.
  { weight: 0.45, multiplier: { min: 0.55, max: 0.78 }, duration: { min: 4, max: 9 } },
  { weight: 0.4, multiplier: { min: 1.3, max: 1.6 }, duration: { min: 2, max: 5 } },
  { weight: 0.15, multiplier: { min: 1.85, max: 2.2 }, duration: { min: 0.8, max: 1.6 } },
]

/**
 * Maps a 0-to-1 draw onto a band.
 *
 * @param draw - The draw, 0 to 1.
 * @param band - The band to map onto.
 * @returns The mapped value.
 */
function spread(draw: number, band: { min: number; max: number }): number {
  return band.min + draw * (band.max - band.min)
}

/** A koi's seeded pace timeline: bounded speed events over plain cruising. */
export interface PaceSchedule {
  /**
   * The cruise-speed multiplier scheduled for a moment.
   *
   * Between events the multiplier is exactly 1; during an event it holds the
   * event's value. The caller eases its actual speed toward the target, so the
   * steps here become smooth accelerations in the water.
   *
   * @param elapsedS - The koi's own clock, in seconds; must not run backwards.
   * @returns The multiplier on the koi's own cruise speed.
   */
  multiplier(elapsedS: number): number
}

/**
 * Creates a koi's seeded pace schedule.
 *
 * The timeline alternates rest and event forever: a rest of six to fourteen
 * seconds, then exactly one event — a loaf, a brisk stretch, or a rare burst —
 * then rest again. Events therefore never stack or overlap by construction.
 *
 * @param seed - The koi's stable seed.
 * @returns The schedule.
 *
 * @example Easing toward the scheduled pace
 * ```typescript
 * const pace = createPaceSchedule(seed)
 * const target = cruise * pace.multiplier(elapsedS)
 * ```
 */
export function createPaceSchedule(seed: number): PaceSchedule {
  const draw = (cycle: number, slot: number): number => randomPseudo(seed + PACE_DRAWS + cycle * 11 + slot)

  /**
   * One rest-then-event cycle of the timeline.
   *
   * @param cycle - The cycle index.
   * @returns Its rest length, event length, and event multiplier.
   */
  const describe = (cycle: number): { restS: number; eventS: number; multiplier: number } => {
    const kindDraw = draw(cycle, 1)
    const loaf = PACE_EVENTS[0]
    const brisk = PACE_EVENTS[1]
    const burst = PACE_EVENTS[2]
    const event = kindDraw < loaf.weight ? loaf : kindDraw < loaf.weight + brisk.weight ? brisk : burst
    return {
      restS: spread(draw(cycle, 0), PACE_REST_S),
      eventS: spread(draw(cycle, 2), event.duration),
      multiplier: spread(draw(cycle, 3), event.multiplier),
    }
  }

  let cycle = 0
  let cycleStartS = 0

  return {
    multiplier(elapsedS) {
      if (elapsedS < cycleStartS) {
        // why: A clock that restarted must replay the timeline from its own zero, not walk backwards through a cursor built for a longer life.
        cycle = 0
        cycleStartS = 0
      }
      let described = describe(cycle)
      while (elapsedS >= cycleStartS + described.restS + described.eventS) {
        cycleStartS += described.restS + described.eventS
        cycle += 1
        described = describe(cycle)
      }
      return elapsedS - cycleStartS < described.restS ? 1 : described.multiplier
    },
  }
}

/** How often a chosen waypoint deliberately crosses the visible window. */
const VIEW_BIAS = 0.1

/** How far inside the visible window a biased waypoint lands, as a fraction of each axis. */
const VIEW_INSET = 0.12

/** How close a koi must come to a waypoint before it counts as reached, in fish lengths. */
const ARRIVE_FISH_LENGTHS = 1.5

/** Longest a koi chases one waypoint before it loses interest, in seconds. */
const LEG_TIMEOUT_S = 24

/** The waypoint a koi is currently swimming toward, and which leg of its life this is. */
export interface WaypointLeg {
  /** The waypoint in pond space. */
  point: Vec2
  /** Monotonic leg counter; a new value means a fresh waypoint was just chosen. */
  leg: number
}

/** A koi's seeded itinerary across the pond. */
export interface Itinerary {
  /**
   * The waypoint to swim toward right now.
   *
   * Advances to the next leg when the koi arrives or loses interest. The
   * returned object is reused between calls — read it, do not keep it.
   *
   * @param pond - The announced environment.
   * @param position - The koi's nose in pond space.
   * @param elapsedS - The koi's own clock, in seconds.
   * @returns The current waypoint and leg counter.
   */
  current(pond: PondEnvironment, position: Vec2, elapsedS: number): WaypointLeg
  /**
   * Abandons the current waypoint so the next call picks a fresh one.
   *
   * For the moments when the world overrules the itinerary — a boundary
   * correction or a re-entry — and chasing the old point would immediately
   * steer back into the problem.
   */
  abandon(): void
}

/**
 * Creates a koi's seeded itinerary.
 *
 * Waypoints are drawn uniformly over the whole virtual pond — outskirts
 * included — except that roughly one in ten is placed inside the currently
 * visible window, which is what nudges trajectories through the water a
 * visitor is actually looking at without ever fencing the fish in.
 *
 * @param seed - The koi's stable seed.
 * @returns The itinerary.
 *
 * @example Steering along the itinerary
 * ```typescript
 * const itinerary = createItinerary(seed)
 * const { point, leg } = itinerary.current(pond, position, elapsedS)
 * ```
 */
export function createItinerary(seed: number): Itinerary {
  const draw = (leg: number, slot: number): number => randomPseudo(seed + ITINERARY_DRAWS + leg * 7 + slot)

  let leg = -1
  let legStartS = 0
  const waypoint: WaypointLeg = { point: { x: 0, y: 0 }, leg: -1 }

  /**
   * Chooses the next waypoint.
   *
   * @param pond - The announced environment.
   * @param elapsedS - The koi's own clock, in seconds.
   */
  const advance = (pond: PondEnvironment, elapsedS: number): void => {
    leg += 1
    legStartS = elapsedS
    const { view } = pond
    // why: The bias draws against the leg index, so whether a leg crosses the view is as stable across reloads as where it goes.
    if (draw(leg, 0) < VIEW_BIAS && view.width > 0 && view.height > 0) {
      waypoint.point.x = view.x + view.width * (VIEW_INSET + draw(leg, 1) * (1 - VIEW_INSET * 2))
      waypoint.point.y = view.y + view.height * (VIEW_INSET + draw(leg, 2) * (1 - VIEW_INSET * 2))
    } else {
      waypoint.point.x = draw(leg, 1) * pond.width
      waypoint.point.y = draw(leg, 2) * pond.height
    }
    waypoint.leg = leg
  }

  return {
    current(pond, position, elapsedS) {
      const arrive = pond.fishLength * ARRIVE_FISH_LENGTHS
      if (
        leg < 0 ||
        elapsedS - legStartS > LEG_TIMEOUT_S ||
        Math.hypot(position.x - waypoint.point.x, position.y - waypoint.point.y) < arrive
      ) {
        advance(pond, elapsedS)
      }
      return waypoint
    },
    abandon() {
      legStartS = -LEG_TIMEOUT_S * 2
    },
  }
}

/** How long a koi that slipped out stays out of the pond before it wraps, in seconds. */
export const SHORE_ABSENT_S = 5

/** How likely a koi is to ignore a boundary correction and keep its course. */
const SLIP_CHANCE = 0.2

/**
 * Whether a koi ignores this particular boundary approach and keeps swimming.
 *
 * Rolled once per approach — the crossing index makes each approach its own
 * seeded draw — so a koi never flickers between obeying and ignoring the same
 * correction, and roughly one approach in five carries it out of the pond.
 *
 * @param seed - The koi's stable seed.
 * @param crossing - How many boundary approaches this koi has made so far.
 * @returns `true` when the koi holds its course and leaves the pond.
 *
 * @example Rolling once as the boundary engages
 * ```typescript
 * if (slipsAway(seed, crossings)) {
 *   leaving = true
 * }
 * ```
 */
export function slipsAway(seed: number, crossing: number): boolean {
  return randomPseudo(seed + SHORE_DRAWS + crossing * 3) < SLIP_CHANCE
}

/**
 * Carries a position that left pond space across to the opposite side.
 *
 * The wrap is toroidal: a koi that swam out past the right edge reappears just
 * outside the left one with its heading still valid, so its eventual re-entry
 * reads as the same fish coming back from somewhere else. Coordinates inside
 * pond space pass through untouched.
 *
 * @param pond - The announced environment.
 * @param position - The position to wrap.
 * @returns The wrapped position.
 *
 * @example Re-entering after an absence
 * ```typescript
 * position = wrapAcross(pond, position)
 * ```
 */
export function wrapAcross(pond: PondEnvironment, position: Vec2): Vec2 {
  const bounds = pondBounds(pond)
  const spanX = bounds.right - bounds.left
  const spanY = bounds.bottom - bounds.top
  let { x, y } = position
  if (x > bounds.right) {
    x -= spanX
  } else if (x < bounds.left) {
    x += spanX
  }
  if (y > bounds.bottom) {
    y -= spanY
  } else if (y < bounds.top) {
    y += spanY
  }
  return { x, y }
}
