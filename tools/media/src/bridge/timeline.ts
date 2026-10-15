import type { BridgeConfig } from '../models/bridge'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** How long a line's chip takes to appear before its characters start typing. */
export const CHIP_MS = 160

/** How long after a line is typed the next one starts. */
export const LINE_GAP_MS = 240

/** How long after a line is typed its wire sets off. */
export const WIRE_LEAD_MS = 80

/** How long a wire takes to draw from the line to the socket. */
export const WIRE_MS = 450

/** How long a label takes to light once a wire lands on its socket. */
export const LIGHT_MS = 250

/** How long the ring round a socket lasts when a wire lands on it. */
export const PULSE_MS = 500

/** How long after the last wire lands the verdict sets off back along the test's wire. */
export const RUN_LEAD_MS = 320

/** How long the verdict takes to come back along the wire to the test. */
export const RETURN_MS = 420

/** How long the check beside the test takes to draw. */
export const CHECK_MS = 300

/** How long after the check lands the figures appear. */
export const FIGURE_LEAD_MS = 260

/** How long the figures take to appear. */
export const FIGURE_MS = 260

/** How long a figure takes to count up to its value. */
export const COUNT_MS = 900

/** How long after one figure starts counting the next one does. */
export const COUNT_STAGGER_MS = 130

/** How long after the last figure settles the tick lands. */
export const TICK_LEAD_MS = 180

/** How long the tick takes to draw. */
export const TICK_MS = 360

/** How long the caret stays after a line's last character is typed. */
export const CARET_LINGER_MS = 240

/** Breath after the tick lands before the frame counts as settled. */
const SETTLE_MS = 300

/** When one line of the listing appears. */
export interface LineSchedule {
  /** When the line starts: its chip appears, or its first character for a line without one. */
  startAt: number
  /** When its characters start typing. */
  textAt: number
  /** When its last character is typed. */
  typedAt: number
}

/** When one wire draws. */
export interface WireSchedule {
  /** Index of the line the wire leaves. */
  line: number
  /** Index of the primitive it reaches. */
  primitive: number
  /** When it sets off. */
  startAt: number
  /** When it lands on the socket. */
  landAt: number
}

/** Every moment on the stage's timeline. */
export interface BridgeTimeline {
  /** When each line appears, index for index with the listing. */
  lines: readonly LineSchedule[]
  /** When each wire draws, in the order its line is typed. */
  wires: readonly WireSchedule[]
  /** When the verdict sets off back along the test's wire. */
  runAt: number
  /** When the check lands beside the test. */
  checkAt: number
  /** When the figures appear. */
  figuresAt: number
  /** When each figure starts counting, index for index with the report's. */
  countsAt: readonly number[]
  /** When the tick lands. */
  tickAt: number
  /** When nothing is moving any more. */
  settledAt: number
}

/**
 * Lay the whole timeline out from the scene's configuration.
 *
 * The lines type one after another, each wire setting off as its line is
 * typed; a blank line takes no time. Once the last wire has landed the
 * verdict comes back along the test's wire, the check lands, the figures
 * appear and count up one after another, and the tick lands. Nothing is
 * remembered between frames.
 *
 * @param config - The bridge as the scene configured it.
 * @returns Every moment the renderer keys off.
 * @example When the loop rests
 * ```ts
 * bridgeTimeline(config).settledAt
 * ```
 */
export function bridgeTimeline(config: BridgeConfig): BridgeTimeline {
  let cursor = config.typeAtMs
  const lines = config.lines.map((line): LineSchedule => {
    if (line.api === undefined && line.text === '') {
      return { startAt: cursor, textAt: cursor, typedAt: cursor }
    }
    const startAt = cursor
    const textAt = startAt + (line.api === undefined ? 0 : CHIP_MS)
    const typedAt = textAt + (line.text.length * 1000) / config.typeCps
    cursor = typedAt + LINE_GAP_MS
    return { startAt, textAt, typedAt }
  })
  const wires = config.lines.flatMap((line, index): WireSchedule[] => {
    const schedule = lines[index]
    if (line.rests === undefined || schedule === undefined) {
      return []
    }
    const startAt = schedule.typedAt + WIRE_LEAD_MS
    return [{ line: index, primitive: line.rests, startAt, landAt: startAt + WIRE_MS }]
  })
  const typed = lines.reduce((latest, line) => max(latest, line.typedAt), 0)
  const landed = wires.reduce((latest, wire) => max(latest, wire.landAt), 0)
  const runAt = max(typed, landed) + RUN_LEAD_MS
  const returns = wires.some((wire) => config.lines[wire.line]?.verdict === true)
  const checkAt = runAt + (returns ? RETURN_MS : 0)
  const figuresAt = checkAt + CHECK_MS + FIGURE_LEAD_MS
  const countsAt = config.report.figures.map((_, index) => figuresAt + FIGURE_MS / 2 + COUNT_STAGGER_MS * index)
  const counted = countsAt.reduce((latest, at) => max(latest, at + COUNT_MS), figuresAt + FIGURE_MS)
  const tickAt = counted + TICK_LEAD_MS
  return { lines, wires, runAt, checkAt, figuresAt, countsAt, tickAt, settledAt: tickAt + TICK_MS + SETTLE_MS }
}
