import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { easeInOut, easeOut, progress, pulse } from '../lib/motion'

/** When the hostee finishes starting, in both panels. */
export const HOSTEE_READY_MS = 2_400

/** How long a message takes to cross the wire. */
const FLIGHT_MS = 1_000

/** The whole timeline. */
export const NEGOTIATION_END_MS = 8_800

/** A message crossing the wire. */
export interface Flight {
  /** What it is called, drawn above the dot. */
  label: string
  /** When it leaves. */
  departMs: number
  /** Whether it travels from the host to the hostee, or back. */
  toHostee: boolean
  /** What happens when it lands: delivered, lost, or unanswered. */
  outcome: 'delivered' | 'lost' | 'unanswered'
}

/** The messages of the panel in which the channel activates itself. */
const BEFORE_FLIGHTS: readonly Flight[] = [
  { label: 'message', departMs: 600, toHostee: true, outcome: 'lost' },
  { label: 'message', departMs: 2_800, toHostee: true, outcome: 'delivered' },
  { label: 'reply', departMs: 4_100, toHostee: false, outcome: 'delivered' },
  { label: 'message', departMs: 6_000, toHostee: true, outcome: 'delivered' },
  { label: 'reply', departMs: 7_300, toHostee: false, outcome: 'delivered' },
]

/** The messages of the panel in which the channel waits for a handshake. */
const AFTER_FLIGHTS: readonly Flight[] = [
  { label: 'hello', departMs: 600, toHostee: true, outcome: 'unanswered' },
  { label: 'hello', departMs: 2_600, toHostee: false, outcome: 'delivered' },
  { label: 'accept', departMs: 3_700, toHostee: true, outcome: 'delivered' },
  { label: 'confirm', departMs: 4_800, toHostee: false, outcome: 'delivered' },
  { label: 'message', departMs: 6_000, toHostee: true, outcome: 'delivered' },
  { label: 'reply', departMs: 7_300, toHostee: false, outcome: 'delivered' },
]

/** When the handshake completes and the session exists. */
export const SESSION_MS = 4_800 + FLIGHT_MS

/** A message drawn at one instant. */
export interface FlightState {
  /** What it is called. */
  label: string
  /** How far across the wire it is, from the host's end. */
  t: number
  /** How opaque it is drawn. */
  opacity: number
}

/** What one panel shows at one instant. */
export interface PanelState {
  /** Whether the wire is live. */
  live: boolean
  /** Whether the hostee has started. */
  hosteeReady: boolean
  /** Whether the host is waiting for an answer to its greeting. */
  waiting: boolean
  /** The messages in flight. */
  flights: readonly FlightState[]
  /** How strongly the lost mark is drawn, 0 before anything is lost. */
  lost: number
  /** How strongly the host's card flashes for a delivery. */
  hostFlash: number
  /** How strongly the hostee's card flashes for a delivery. */
  hosteeFlash: number
  /** How far the session badge has appeared, 0 for not at all. */
  session: number
}

/**
 * The messages of a list that are on the wire at one instant.
 *
 * @param flights - The panel's messages.
 * @param atMs - Offset from the start of the timeline.
 * @returns Each message in flight, with its position and how visible it is.
 */
function flightsAt(flights: readonly Flight[], atMs: number): readonly FlightState[] {
  const states: FlightState[] = []
  for (const flight of flights) {
    const arriveMs = flight.departMs + FLIGHT_MS
    if (atMs < flight.departMs || atMs >= arriveMs + 400) {
      continue
    }
    const raw = progress(atMs, flight.departMs, FLIGHT_MS)
    const across = easeInOut(raw)
    const t = flight.toHostee ? across : 1 - across
    // why: a message that lands on nothing keeps going a little and dissolves; one that is delivered vanishes into the card at once
    const linger = atMs >= arriveMs
    if (linger && flight.outcome === 'delivered') {
      continue
    }
    const fade = linger ? 1 - progress(atMs, arriveMs, 400) : 1
    states.push({ label: flight.label, t: linger ? t + (flight.toHostee ? 0.02 : -0.02) : t, opacity: fade })
  }
  return states
}

/**
 * How strongly a card flashes for messages delivered to it.
 *
 * @param flights - The panel's messages.
 * @param toHostee - Whether the card is the hostee's.
 * @param atMs - Offset from the start of the timeline.
 * @returns Intensity from 0 to 1.
 */
function flashAt(flights: readonly Flight[], toHostee: boolean, atMs: number): number {
  return flights
    .filter((flight) => flight.toHostee === toHostee && flight.outcome === 'delivered')
    .reduce((strongest, flight) => max(strongest, pulse(atMs, flight.departMs + FLIGHT_MS, 700)), 0)
}

/**
 * What the panel in which the channel activates itself shows at one instant.
 *
 * @param atMs - Offset from the start of the timeline.
 * @returns The state to draw.
 */
export function beforeStateAt(atMs: number): PanelState {
  const lostAt = 600 + FLIGHT_MS
  return {
    live: true,
    hosteeReady: atMs >= HOSTEE_READY_MS,
    waiting: false,
    flights: flightsAt(BEFORE_FLIGHTS, atMs),
    lost: atMs < lostAt ? 0 : 0.7 + 0.3 * pulse(atMs, lostAt, 900),
    hostFlash: flashAt(BEFORE_FLIGHTS, false, atMs),
    hosteeFlash: flashAt(BEFORE_FLIGHTS, true, atMs),
    session: 0,
  }
}

/**
 * What the panel in which the channel waits for a handshake shows at one
 * instant.
 *
 * @param atMs - Offset from the start of the timeline.
 * @returns The state to draw.
 */
export function afterStateAt(atMs: number): PanelState {
  return {
    live: atMs >= SESSION_MS,
    hosteeReady: atMs >= HOSTEE_READY_MS,
    waiting: atMs >= 600 + FLIGHT_MS && atMs < 2_600 + FLIGHT_MS,
    flights: flightsAt(AFTER_FLIGHTS, atMs),
    lost: 0,
    hostFlash: flashAt(AFTER_FLIGHTS, false, atMs),
    hosteeFlash: flashAt(AFTER_FLIGHTS, true, atMs),
    session: easeOut(progress(atMs, SESSION_MS, 350)),
  }
}
