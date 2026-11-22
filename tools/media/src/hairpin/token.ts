import type { HairpinConfig } from '../models/hairpin'
import type { Point } from '../stage/geometry'
import type { HairpinLayout } from './layout'
import type { HairpinTimeline, Trip } from './timeline'
import { abs, PI, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { clamp01, easeIn, easeInOut, easeOut, progress } from '../lib/motion'
import { onTurn } from './layout'
import { REFUSED_FADE_MS, REFUSED_WAIT_MS } from './timeline'

/** How long before the head of the turn a request starts to fill into a value. */
const FILL_LEAD_MS = 70

/** How long a band takes to close round a value as it passes the step that adds it. */
export const BAND_MS = 260

/** How long a refused request rocks back from the closed way in. */
const RECOIL_MS = 420

/** One request or response as it is drawn at one instant. */
export interface Token {
  /** Where it is. */
  at: Point
  /** How much of a value it is: 0 for a request still asking, 1 for a response. */
  filled: number
  /** How far each band it has gained has closed round it, in the order it gained them. */
  bands: readonly number[]
  /** How visible it is. */
  opacity: number
  /** Whether it is inside the process. */
  inside: boolean
  /** Whether it was turned away at the closed way in. */
  refused: boolean
}

/** The moment a step marks one returning value. */
export interface BandMoment {
  /** Index of the step that adds the band. */
  step: number
  /** When the value passes the middle of that step's pane. */
  atMs: number
}

/**
 * When each band lands on a returning value.
 *
 * A value passes back through every step ahead of the one that answered it,
 * nearest first, and each of those that marks what comes back adds its band
 * as the value crosses the middle of its pane.
 *
 * @param trip - The request's trip.
 * @param config - The service as the scene configured it.
 * @param layout - Where everything sits.
 * @param timeline - Every moment of the stage.
 * @returns The bands in the order the value gains them.
 */
export function bandMoments(trip: Trip, config: HairpinConfig, layout: HairpinLayout, timeline: HairpinTimeline): readonly BandMoment[] {
  const turnX = layout.panes[trip.step]?.turnX
  if (trip.refused || turnX === undefined) {
    return []
  }
  const moments: BandMoment[] = []
  for (let step = trip.step - 1; step >= 0; step -= 1) {
    const pane = layout.panes[step]
    if (pane !== undefined && config.steps[step]?.decorates === true) {
      moments.push({ step, atMs: trip.turnedAt + (turnX - pane.centreX) / timeline.speed })
    }
  }
  return moments
}

/**
 * Where a refused request is, and how much of it is left.
 *
 * It travels to the closed way in at the pace of any other request, rocks
 * back once from it, waits, and fades as it drifts off: nobody answers it.
 *
 * @param trip - The request's trip.
 * @param layout - Where everything sits.
 * @param timeline - Every moment of the stage.
 * @param atMs - Offset from the start of the timeline.
 * @returns The token to draw.
 */
function refusedAt(trip: Trip, layout: HairpinLayout, timeline: HairpinTimeline, atMs: number): Token {
  const fade = progress(atMs, trip.doorAt + REFUSED_WAIT_MS, REFUSED_FADE_MS)
  const rock = progress(atMs, trip.doorAt, RECOIL_MS)
  const x =
    atMs < trip.doorAt
      ? layout.edgeX + (atMs - trip.startAt) * timeline.speed
      : layout.haltX - 7 * layout.unit * sin(PI * rock) * (1 - rock) - 14 * layout.unit * easeIn(fade)
  return { at: { x, y: layout.inY }, filled: 0, bands: [], opacity: 1 - fade, inside: false, refused: true }
}

/**
 * Where a request that was let in is on its way round.
 *
 * @param trip - The request's trip.
 * @param layout - Where everything sits.
 * @param timeline - Every moment of the stage.
 * @param atMs - Offset from the start of the timeline.
 * @returns The point it is drawn at.
 */
function positionAt(trip: Trip, layout: HairpinLayout, timeline: HairpinTimeline, atMs: number): Point {
  const turnX = layout.panes[trip.step]?.turnX ?? layout.shell.x
  if (atMs < trip.turnAt) {
    return { x: layout.edgeX + (atMs - trip.startAt) * timeline.speed, y: layout.inY }
  }
  if (atMs < trip.headAt) {
    return onTurn(layout, turnX, 0.5 * progress(atMs, trip.turnAt, trip.headAt - trip.turnAt))
  }
  if (atMs < trip.turnedAt) {
    return onTurn(layout, turnX, 0.5 + 0.5 * progress(atMs, trip.leaveAt, trip.turnedAt - trip.leaveAt))
  }
  return { x: turnX - (atMs - trip.turnedAt) * timeline.speed, y: layout.outY }
}

/**
 * One request or response at one instant.
 *
 * A request is drawn hollow and a response solid, and the change happens at
 * the head of the turn inside the step that answers: the request arrives
 * asking, rests there for as long as the step works, and what sets off back
 * is a value. Nothing is remembered between frames; the whole state is read
 * out of the trip and the moment asked for.
 *
 * @param trip - The request's trip.
 * @param config - The service as the scene configured it.
 * @param layout - Where everything sits.
 * @param timeline - Every moment of the stage.
 * @param atMs - Offset from the start of the timeline.
 * @returns The token to draw, or undefined while the request is not in the frame.
 */
export function tokenAt(
  trip: Trip,
  config: HairpinConfig,
  layout: HairpinLayout,
  timeline: HairpinTimeline,
  atMs: number
): Token | undefined {
  if (atMs < trip.startAt || atMs >= trip.goneAt) {
    return undefined
  }
  if (trip.refused) {
    return refusedAt(trip, layout, timeline, atMs)
  }
  return {
    at: positionAt(trip, layout, timeline, atMs),
    filled: easeInOut(progress(atMs, trip.headAt - FILL_LEAD_MS, trip.leaveAt - trip.headAt + 2 * FILL_LEAD_MS)),
    bands: bandMoments(trip, config, layout, timeline).map((moment) => easeOut(progress(atMs, moment.atMs, BAND_MS))),
    opacity: 1,
    inside: atMs >= trip.doorAt && atMs < trip.outAt,
    refused: false,
  }
}

/**
 * How strongly a pane is lit by one token.
 *
 * @param token - The request or response being drawn.
 * @param centreX - Horizontal centre of the pane.
 * @param width - Width of the pane.
 * @returns 1 while the token is within the pane, falling to 0 a little outside it.
 */
export function nearness(token: Token, centreX: number, width: number): number {
  return token.inside ? clamp01(1 - (abs(token.at.x - centreX) - width * 0.42) / (width * 0.3)) : 0
}
