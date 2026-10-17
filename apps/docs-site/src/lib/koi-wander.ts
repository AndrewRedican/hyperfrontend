import type { PondEnvironment, Vec2 } from '@hyperfrontend/demo-koi-lib'
import { createPaceSchedule, headingTo, turnToward, wanderOffset, wrapAcross, wrapAngle } from '@hyperfrontend/demo-koi-lib'
import { abs, cos, exp, hypot, imul, max, min, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** The window of the water currently on screen, in the water's own coordinates. */
export interface KoiView {
  /** Left edge, in CSS pixels */
  x: number
  /** Top edge, in CSS pixels */
  y: number
  /** Width, in CSS pixels */
  width: number
  /** Height, in CSS pixels */
  height: number
}

/** The water the koi has to swim in, and which part of it the reader is looking at. */
export interface KoiWorld {
  /** Width of the water, in CSS pixels */
  width: number
  /** Height of the water, in CSS pixels */
  height: number
  /** The window of the water currently on screen */
  view: KoiView
  /** Nose-to-tail length of the koi, in CSS pixels */
  fishLength: number
}

/** Where the koi is and what it is doing, after a step. */
export interface KoiWanderState {
  /** Pivot position in the water's coordinates */
  x: number
  /** Pivot position in the water's coordinates */
  y: number
  /** Which way the nose points, in radians */
  heading: number
  /** How fast it swims, in body lengths per second */
  speed: number
  /** How fast it turns, in radians per second */
  turnRate: number
}

/** The koi's mind: step it and read where it got to. */
export interface KoiWander {
  /**
   * Advance the koi through one frame.
   *
   * @param dt - Seconds since the previous frame
   * @param world - The water as it is right now
   * @returns Where the koi is after the step
   */
  step(dt: number, world: KoiWorld): KoiWanderState
}

/** Cruising speed, in body lengths per second; the pace schedule scales it. */
const CRUISE = 0.4

/** The hardest the koi turns, in radians per second. */
const MAX_TURN = 0.8

/** Seconds the speed takes to close most of the gap to its target. */
const SPEED_RESPONSE = 1.4

/** Seconds the reported turn rate takes to settle, so the body bends into a turn rather than snapping. */
const TURN_RESPONSE = 0.35

/** How much of the wander's slow weave is laid over the course to the waypoint. */
const WEAVE = 0.3

/** How close to a waypoint counts as arriving, in body lengths. */
const ARRIVE = 0.7

/** Longest the koi chases one waypoint before choosing another, in seconds. */
const LEG_TIMEOUT_S = 22

/** How far past each edge the water extends, in body lengths, before a koi that left it is carried across. */
const MARGIN_LENGTHS = 1.6

/** Share of legs that go somewhere on screen. */
const IN_VIEW = 0.55

/** Share of legs that go somewhere on screen or within a screen of it; the rest leave the water altogether. */
const NEAR_VIEW = 0.86

/** How far in from the view's edges an on-screen waypoint is placed, as a fraction of the view. */
const VIEW_INSET = 0.14

/** How far from the middle of the view, in view heights, a koi and its waypoint may both be before the leg is given up for one that returns to the reader. */
const FAR_FROM_READER = 0.8

/**
 * A stable draw in [0, 1) for one slot of one leg of one koi's life.
 *
 * Seeded rather than random for the reason the pond's own schedules are: the
 * same fish lives the same life on every visit.
 *
 * @param seed - The koi's seed
 * @param leg - Which leg of the koi's life the draw belongs to
 * @param slot - Which of that leg's draws this is
 * @returns A number in [0, 1)
 */
function draw(seed: number, leg: number, slot: number): number {
  let t = (seed * 374761393 + leg * 668265263 + slot * 1274126177 + 0x6d2b79f5) | 0
  t = imul(t ^ (t >>> 15), t | 1)
  t ^= t + imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * Move a value toward a target at a fixed time constant, frame-rate independently.
 *
 * @param current - Where the value is now
 * @param target - Where it is heading
 * @param response - Seconds to close most of the gap
 * @param dt - Seconds elapsed
 * @returns The advanced value
 */
function chase(current: number, target: number, response: number, dt: number): number {
  return current + (target - current) * (1 - exp(-dt / response))
}

/**
 * One koi's seeded wander through the water below the fold.
 *
 * The verbs are the pond's: the pace schedule that loafs and bursts over plain
 * cruising, the slow weave laid over every course, the turn that never exceeds
 * what the animal can do, and the toroidal wrap that carries a fish that left
 * one edge back in at the other. What is chosen here is only where to go.
 * Most legs go somewhere the reader can see; a few go a screen away; one in
 * seven leaves the water entirely, so the koi is sometimes simply gone and
 * then back from the far side, as the pond's koi are.
 *
 * @param seed - The koi's seed, which fixes its whole life
 * @returns The koi's mind
 */
export function createKoiWander(seed: number): KoiWander {
  const pace = createPaceSchedule(seed)
  const position: Vec2 = { x: 0, y: 0 }
  const waypoint: Vec2 = { x: 0, y: 0 }
  let heading = 0
  let speed = CRUISE
  let turnRate = 0
  let elapsed = 0
  let leg = -1
  let legStart = 0
  let started = false

  const choose = (world: KoiWorld, margin: number, returning = false) => {
    leg += 1
    legStart = elapsed
    const kind = draw(seed, leg, 0)
    const { view } = world
    // why: a koi the reader has scrolled away from comes back on screen rather than rolling the dice again somewhere they cannot see
    if (returning || kind < IN_VIEW) {
      waypoint.x = view.x + view.width * (VIEW_INSET + draw(seed, leg, 1) * (1 - VIEW_INSET * 2))
      waypoint.y = view.y + view.height * (VIEW_INSET + draw(seed, leg, 2) * (1 - VIEW_INSET * 2))
    } else if (kind < NEAR_VIEW) {
      waypoint.x = draw(seed, leg, 1) * world.width
      waypoint.y = min(world.height, max(0, view.y + (draw(seed, leg, 2) * 3 - 1) * view.height))
    } else {
      waypoint.x = draw(seed, leg, 1) < 0.5 ? -margin - world.fishLength : world.width + margin + world.fishLength
      waypoint.y = view.y + view.height * draw(seed, leg, 2)
    }
  }

  return {
    step(dt, world) {
      const margin = world.fishLength * MARGIN_LENGTHS
      const pond: PondEnvironment = {
        width: world.width,
        height: world.height,
        margin,
        fishLength: world.fishLength,
        view: world.view,
        depthLevels: 3,
        reducedMotion: false,
      }
      if (!started) {
        started = true
        position.x = -world.fishLength
        position.y = world.view.y + world.view.height * 0.55
        heading = 0
        choose(world, margin)
      }
      elapsed += dt
      const arrived = hypot(position.x - waypoint.x, position.y - waypoint.y) < world.fishLength * ARRIVE
      // why: the reader scrolls and the koi does not follow; when both the fish and where it was going are a screen or more from the view, the leg is given up for one that comes back to the reader
      const middle = world.view.y + world.view.height / 2
      const far = (y: number) => abs(y - middle) > world.view.height * FAR_FROM_READER
      if (arrived || elapsed - legStart > LEG_TIMEOUT_S) choose(world, margin)
      else if (far(position.y) && far(waypoint.y)) choose(world, margin, true)

      const desired = headingTo(position, waypoint) + wanderOffset(seed, elapsed) * WEAVE
      const next = turnToward(heading, desired, MAX_TURN * dt)
      const turned = dt > 0 ? wrapAngle(next - heading) / dt : 0
      turnRate = chase(turnRate, turned, TURN_RESPONSE, dt)
      heading = next
      speed = chase(speed, CRUISE * pace.multiplier(elapsed), SPEED_RESPONSE, dt)
      position.x += cos(heading) * speed * world.fishLength * dt
      position.y += sin(heading) * speed * world.fishLength * dt

      const wrapped = wrapAcross(pond, position)
      if (wrapped.x !== position.x || wrapped.y !== position.y) {
        position.x = wrapped.x
        position.y = wrapped.y
        // why: the leg that took the koi out is over; chasing its waypoint from the far side would send it straight back out
        choose(world, margin)
      }
      return { x: position.x, y: position.y, heading, speed, turnRate }
    },
  }
}
