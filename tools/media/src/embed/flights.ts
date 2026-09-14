import type { EmbedEvent, EmbedSide } from '../models/embed'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { pulse } from '../lib/motion'
import { BEAT_FLIGHT_MS, EVENT_FLIGHT_MS, GLOW_MS, PRESENT_DELAY_MS } from './durations'

/** How long a beat brushes the end it lands on. */
const BEAT_GLOW_MS = 300

/** How bright a beat brushes it, against an event's full glow. */
const BEAT_GLOW_STRENGTH = 0.35

/** One dot's crossing of the wire. */
export interface Flight {
  /** Which end it leaves from. */
  from: EmbedSide
  /** When it leaves. */
  departMs: number
  /** How long the crossing takes. */
  flightMs: number
  /** Whether it is an event dot or the smaller beat. */
  size: 'event' | 'beat'
  /** Text travelling with the dot, if any. */
  label?: string
  /** Colour the dot is drawn in; the accent unless it carries an unsaved-work declaration. */
  tone?: 'accent' | 'warning'
}

/** A dot part way across the wire. */
export interface FlightAt {
  /** The crossing. */
  flight: Flight
  /** Eased position from the departure end (0) to the arrival end (1). */
  t: number
}

/**
 * Every crossing of the wire the script implies.
 *
 * @param script - The events, in any order.
 * @returns The crossings, in departure order.
 */
export function flightsOf(script: readonly EmbedEvent[]): readonly Flight[] {
  const flights: Flight[] = []
  for (const event of script) {
    if (event.kind === 'pulse') {
      flights.push({ from: event.from, departMs: event.atMs, flightMs: event.flightMs ?? EVENT_FLIGHT_MS, size: 'event' })
    } else if (event.kind === 'beat') {
      const every = event.everyMs ?? 0
      const until = every > 0 ? (event.untilMs ?? event.atMs) : event.atMs
      for (let at = event.atMs; at <= until; at += every > 0 ? every : until + 1) {
        flights.push({ from: 'feature', departMs: at, flightMs: event.flightMs ?? BEAT_FLIGHT_MS, size: 'beat' })
      }
    } else if (event.kind === 'present') {
      flights.push({ from: 'host', departMs: event.atMs + PRESENT_DELAY_MS, flightMs: event.flightMs ?? EVENT_FLIGHT_MS, size: 'event' })
    } else if (event.kind === 'visibility') {
      flights.push({ from: 'feature', departMs: event.atMs, flightMs: event.flightMs ?? EVENT_FLIGHT_MS, size: 'event' })
    } else if (event.kind === 'dirty') {
      flights.push({
        from: 'feature',
        departMs: event.atMs,
        flightMs: event.flightMs ?? EVENT_FLIGHT_MS,
        size: 'event',
        tone: event.on ? 'warning' : 'accent',
      })
    } else if (event.kind === 'close') {
      flights.push({ from: 'host', departMs: event.atMs, flightMs: event.flightMs ?? EVENT_FLIGHT_MS, size: 'event' })
    } else if (event.kind === 'message') {
      flights.push({
        from: event.from,
        departMs: event.atMs,
        flightMs: event.flightMs ?? EVENT_FLIGHT_MS,
        size: 'event',
        label: event.label,
      })
    }
  }
  return flights.sort((a, b) => a.departMs - b.departMs)
}

/**
 * When a crossing lands.
 *
 * @param flight - The crossing.
 * @returns The arrival offset.
 * @example A beat that left at zero with the default flight
 * ```ts
 * arrivalOf({ from: 'feature', departMs: 0, flightMs: 450, size: 'beat' }) // 450
 * ```
 */
export function arrivalOf(flight: Flight): number {
  return flight.departMs + flight.flightMs
}

/**
 * The strongest arrival glow at one end of the wire.
 *
 * @param flights - Every crossing.
 * @param from - The end the glowing crossings left from.
 * @param atMs - The moment being drawn.
 * @returns Glow intensity from 0 to 1.
 * @example The host end, a moment after a beat landed
 * ```ts
 * glowAt(flights, 'feature', 460) // rising toward 1
 * ```
 */
export function glowAt(flights: readonly Flight[], from: EmbedSide, atMs: number): number {
  // why: a beat is a cadence rather than an event, so its arrival only brushes the end it lands on, and the full glow stays for the crossings that mean something
  return flights.reduce((strongest, flight) => {
    if (flight.from !== from) {
      return strongest
    }
    const beat = flight.size === 'beat'
    return max(strongest, (beat ? BEAT_GLOW_STRENGTH : 1) * pulse(atMs, arrivalOf(flight), beat ? BEAT_GLOW_MS : GLOW_MS))
  }, 0)
}
