import type { HairpinConfig } from '../models/hairpin'
import type { HairpinLayout } from './layout'
import { max, PI } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** How long the process takes to light and open its way in at the start of the loop. */
export const BOOT_MS = 520

/** How long the signal takes to travel the wire to the process. */
export const SIGNAL_MS = 340

/** How long the way in takes to close once the signal has landed. */
export const DOOR_MS = 300

/** How long the flash round the wall of the process lasts when the signal lands. */
export const ALERT_MS = 900

/** How long after it stops a refused request waits before it starts to fade. */
export const REFUSED_WAIT_MS = 620

/** How long a refused request takes to fade. */
export const REFUSED_FADE_MS = 460

/** How long after the last response has left the process starts to go dark. */
const DARK_LEAD_MS = 260

/** How long the process takes to go dark. */
export const DARK_MS = 520

/** How much later each pane nearer the door goes dark than the one behind it. */
export const DARK_STAGGER_MS = 110

/** How long after the process starts to go dark its exit code sets off down the wire. */
const EXIT_LEAD_MS = 520

/** How long the exit code takes to travel the wire. */
export const EXIT_MS = 400

/** How long the ring round the slot lasts when the code lands in it. */
export const LAND_MS = 700

/** Breath after the code lands before the frame counts as settled. */
const SETTLE_MS = 420

/** The moments of one request's trip. */
export interface Trip {
  /** Index of the step that answers it. */
  step: number
  /** Whether it reached the way in too late and was turned away. */
  refused: boolean
  /** When it enters the frame. */
  startAt: number
  /** When it reaches the wall of the process: through the way in, or up against it when refused. */
  doorAt: number
  /** When it leaves the lane and enters the turn inside the step that answers it. */
  turnAt: number
  /** When it reaches the head of the turn. */
  headAt: number
  /** When its value sets off from the head of the turn. */
  leaveAt: number
  /** When its value rejoins the lane out. */
  turnedAt: number
  /** When its value passes the wall of the process on the way out. */
  outAt: number
  /** When its value has left the frame. */
  goneAt: number
}

/** Every moment on the stage's timeline. */
export interface HairpinTimeline {
  /** How far a request travels in a millisecond, in frame pixels. */
  speed: number
  /** Each request's trip, index for index with the requests. */
  trips: readonly Trip[]
  /** When the signal sets off up the wire. */
  signalAt: number
  /** When it lands and the way in starts to close. */
  stopAt: number
  /** When the last response in flight has passed the wall on its way out. */
  drainedAt: number
  /** When the process starts to go dark. */
  darkAt: number
  /** When the exit code sets off down the wire. */
  exitAt: number
  /** When it lands in the slot. */
  landAt: number
  /** When nothing is left to happen. */
  settledAt: number
}

/**
 * Work out when everything on the stage happens.
 *
 * Nothing but the requests' departures and the stop is stated: where a
 * request turns follows from the step that answers it, whether it is let in
 * follows from whether it reached the way in before the stop, and the process
 * goes dark only once the last request that was let in has been answered.
 * The drain is therefore not drawn to look right; it is what the arithmetic
 * leaves.
 *
 * @param config - The service as the scene configured it.
 * @param layout - Where everything sits.
 * @returns Every moment of the stage.
 */
export function hairpinTimeline(config: HairpinConfig, layout: HairpinLayout): HairpinTimeline {
  const speed = (config.speed / 1000) * layout.unit
  const lastPane = layout.panes.length - 1
  const trips = config.requests.map((request): Trip => {
    const step = max(0, request.answeredBy > lastPane ? lastPane : request.answeredBy)
    const doorAt = request.atMs + (layout.shell.x - layout.edgeX) / speed
    if (doorAt >= config.stopAtMs) {
      const haltAt = request.atMs + (layout.haltX - layout.edgeX) / speed
      return {
        step,
        refused: true,
        startAt: request.atMs,
        doorAt: haltAt,
        turnAt: haltAt,
        headAt: haltAt,
        leaveAt: haltAt,
        turnedAt: haltAt,
        outAt: haltAt,
        goneAt: haltAt + REFUSED_WAIT_MS + REFUSED_FADE_MS,
      }
    }
    const inside = ((layout.panes[step]?.turnX ?? layout.shell.x) - layout.shell.x) / speed
    const half = (PI * layout.turnR) / 2 / speed
    const turnAt = doorAt + inside
    const headAt = turnAt + half
    const leaveAt = headAt + (config.steps[step]?.workMs ?? 0)
    const turnedAt = leaveAt + half
    const outAt = turnedAt + inside
    return {
      step,
      refused: false,
      startAt: request.atMs,
      doorAt,
      turnAt,
      headAt,
      leaveAt,
      turnedAt,
      outAt,
      goneAt: outAt + doorAt - request.atMs,
    }
  })
  const drainedAt = trips.reduce((latest, trip) => (trip.refused ? latest : max(latest, trip.outAt)), config.stopAtMs)
  const darkAt = drainedAt + DARK_LEAD_MS
  const exitAt = darkAt + EXIT_LEAD_MS
  const landAt = exitAt + EXIT_MS
  return {
    speed,
    trips,
    signalAt: config.stopAtMs - SIGNAL_MS,
    stopAt: config.stopAtMs,
    drainedAt,
    darkAt,
    exitAt,
    landAt,
    settledAt: landAt + SETTLE_MS,
  }
}
