import type { EmbedConfig, EmbedEvent, EmbedStatusState, EmbedTickEvent } from '../models/embed'
import type { Flight, FlightAt } from './flights'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { easeInOut, easeOut, progress, pulse } from '../lib/motion'
import {
  BLINK_MS,
  BRACKET_MS,
  DIM_MS,
  DOCK_MS,
  DRAFT_MS,
  EVENT_FLIGHT_MS,
  FILL_MS,
  FIT_MS,
  FLASH_MS,
  GATE_MS,
  GATE_REVEAL_MS,
  GLOW_MS,
  MISS_BUDGET,
  POP_MS,
  PRESENT_DELAY_MS,
  PRESS_MS,
  UNDOCK_MS,
} from './durations'
import { arrivalOf, flightsOf, glowAt } from './flights'

/** How the wire is drawn. */
export type WireLook = 'dashed' | 'accent' | 'warning' | 'rule'

/** What the host's lamp shows. */
export type LampTone = 'idle' | 'success' | 'warning'

/** The watchdog ring at one instant. */
export interface RingState {
  /** Segments filled by counted ticks since the last beat. */
  filled: number
  /** Eased progress of the most recent fill, 1 once settled. */
  fill: number
  /** Whether the miss budget is spent. */
  danger: boolean
  /** Where the sweep marker is between ticks, from 0 to 1. */
  sweep: number
  /** Intensity of the tick blink. */
  blink: number
  /** The word inside the ring, once a status has been reported. */
  word: EmbedStatusState | undefined
}

/** The shutter at one instant. */
export interface GateState {
  /** Eased reveal of the gate's frame. */
  reveal: number
  /** How far down the shutter is, from 0 to 1. */
  descent: number
  /** Whether the shutter has cut the wire. */
  closed: boolean
  /** Whether the shutter is part way down and the wire still delivers. */
  partial: boolean
}

/** The draft document at one instant. */
export interface DraftState {
  /** Eased progress of its crossing, or undefined while it is still inside the feature. */
  travel: number | undefined
  /** Eased pop of the saved document once it has landed. */
  saved: number
  /** Whether it still carries the unsaved marker. */
  dirty: boolean
}

/** The announced size. */
export interface PresentSize {
  /** Width in the feature's pixels. */
  width: number
  /** Height in the feature's pixels. */
  height: number
}

/** Everything the renderer draws at one instant. */
export interface EmbedState {
  /** Eased progress of the feature into the slot, 1 when seated. */
  seat: number
  /** How present the feature is, 1 until it fades out. */
  presence: number
  /** How dimmed the feature is, 1 when its tab is hidden. */
  dim: number
  /** Eased reveal of the eye glyph in the feature's chrome. */
  eye: number
  /** Whether the eye is drawn closed. */
  eyeClosed: boolean
  /** Whether the wire is a live channel. */
  linked: boolean
  /** Intensity of the border flash when the wire goes live. */
  flash: number
  /** How the wire is drawn. */
  wire: WireLook
  /** The shutter, when the script has one. */
  gate: GateState | undefined
  /** Eased drawing of the dimension bracket. */
  bracket: number
  /** The announced size, when the script announces one. */
  present: PresentSize | undefined
  /** How far the feature's content has stretched to the announced size. */
  fit: number
  /** What the host's lamp shows. */
  lamp: LampTone
  /** Glow of the host end after an arrival. */
  portGlow: number
  /** Glow of the feature end after an arrival. */
  socketGlow: number
  /** The watchdog ring, when the script has one. */
  ring: RingState | undefined
  /** The draft, when the script has one. */
  draft: DraftState | undefined
  /** Every dot in flight. */
  flights: readonly FlightAt[]
  /** Eased pop of the receipt in the host. */
  receipt: number
  /** How pressed the close button is. */
  press: number
  /** Whether the close button is drawn at all. */
  closeChip: boolean
}

/**
 * Where the sweep marker is between ticks.
 *
 * The marker completes one lap between consecutive ticks, so it lands exactly
 * on each tick however the script spaces them; before the first and after the
 * last it keeps the neighbouring interval's period.
 *
 * @param ticks - The ticks, in order.
 * @param atMs - The moment being drawn.
 * @returns Lap progress from 0 to 1.
 */
function sweepAt(ticks: readonly EmbedTickEvent[], atMs: number): number {
  const first = ticks[0]
  const last = ticks[ticks.length - 1]
  if (first === undefined || last === undefined) {
    return 0
  }
  const period = max(1, (ticks[1]?.atMs ?? first.atMs + 1000) - first.atMs)
  if (atMs < first.atMs) {
    const elapsed = period - ((first.atMs - atMs) % period)
    return elapsed >= period ? 0 : elapsed / period
  }
  if (atMs >= last.atMs) {
    const tail = max(1, last.atMs - (ticks[ticks.length - 2]?.atMs ?? last.atMs - period))
    return ((atMs - last.atMs) % tail) / tail
  }
  for (let index = 1; index < ticks.length; index += 1) {
    const previous = ticks[index - 1]
    const next = ticks[index]
    if (previous !== undefined && next !== undefined && atMs >= previous.atMs && atMs < next.atMs) {
      return (atMs - previous.atMs) / max(1, next.atMs - previous.atMs)
    }
  }
  return 0
}

/**
 * The watchdog ring at one instant, or undefined when the script has none.
 *
 * @param script - The events.
 * @param flights - Every crossing, for the beats that empty the ring.
 * @param atMs - The moment being drawn.
 * @returns The ring's state.
 */
function ringAt(script: readonly EmbedEvent[], flights: readonly Flight[], atMs: number): RingState | undefined {
  const ticks = script.filter((event): event is EmbedTickEvent => event.kind === 'tick').sort((a, b) => a.atMs - b.atMs)
  const statuses = script.filter((event) => event.kind === 'status')
  if (ticks.length === 0 && statuses.length === 0) {
    return undefined
  }
  const lastClear = flights.reduce((latest, flight) => {
    const arrival = arrivalOf(flight)
    return flight.size === 'beat' && arrival <= atMs ? max(latest, arrival) : latest
  }, -1)
  let filled = 0
  let fill = 1
  for (const tick of ticks) {
    if (tick.counted && tick.atMs <= atMs && tick.atMs > lastClear) {
      filled += 1
      fill = easeOut(progress(atMs, tick.atMs, FILL_MS))
    }
  }
  const blink = ticks.reduce((strongest, tick) => max(strongest, pulse(atMs, tick.atMs, BLINK_MS)), 0)
  let word: EmbedStatusState | undefined = undefined
  for (const status of statuses) {
    if (status.kind === 'status' && status.atMs <= atMs) {
      word = status.state
    }
  }
  return { filled, fill, danger: filled >= MISS_BUDGET, sweep: sweepAt(ticks, atMs), blink, word }
}

/**
 * The shutter at one instant, or undefined when the script has none.
 *
 * @param script - The events.
 * @param atMs - The moment being drawn.
 * @returns The gate's state.
 */
function gateAt(script: readonly EmbedEvent[], atMs: number): GateState | undefined {
  const gates = script.filter((event) => event.kind === 'gate').sort((a, b) => a.atMs - b.atMs)
  const first = gates[0]
  if (first === undefined) {
    return undefined
  }
  let descent = 0
  let target = 0
  for (const gate of gates) {
    if (gate.kind !== 'gate' || atMs < gate.atMs) {
      continue
    }
    const from = target
    target = gate.to
    descent = from + (gate.to - from) * easeInOut(progress(atMs, gate.atMs, gate.durationMs ?? GATE_MS))
  }
  const closed = target >= 1 && descent >= 1
  return { reveal: easeOut(progress(atMs, first.atMs - GATE_REVEAL_MS, GATE_REVEAL_MS)), descent, closed, partial: descent > 0 && !closed }
}

/**
 * The draft at one instant, or undefined when the script has none.
 *
 * @param script - The events.
 * @param atMs - The moment being drawn.
 * @returns The draft's state.
 */
function draftAt(script: readonly EmbedEvent[], atMs: number): DraftState | undefined {
  const dirtyOn = script.some((event) => event.kind === 'dirty' && event.on)
  const draft = script.find((event) => event.kind === 'draft')
  if (!dirtyOn && draft === undefined) {
    return undefined
  }
  const landed = draft !== undefined && draft.kind === 'draft' ? draft.atMs + (draft.durationMs ?? DRAFT_MS) : undefined
  const dirtyOff = script.some((event) => event.kind === 'dirty' && !event.on && event.atMs <= atMs)
  const travel =
    draft !== undefined && draft.kind === 'draft' && atMs >= draft.atMs
      ? easeInOut(progress(atMs, draft.atMs, draft.durationMs ?? DRAFT_MS))
      : undefined
  return {
    travel,
    saved: landed === undefined ? 0 : easeOut(progress(atMs, landed, POP_MS)),
    dirty: dirtyOn && !dirtyOff && (landed === undefined || atMs < landed),
  }
}

/**
 * What the host's lamp shows at one instant.
 *
 * @param script - The events.
 * @param flights - Every crossing.
 * @param atMs - The moment being drawn.
 * @returns The lamp's tone.
 */
function lampAt(script: readonly EmbedEvent[], flights: readonly Flight[], atMs: number): LampTone {
  let amber = false
  for (const event of script) {
    if (event.kind === 'dirty' && event.atMs + (event.flightMs ?? EVENT_FLIGHT_MS) <= atMs) {
      amber = event.on
    }
  }
  const draft = script.find((event) => event.kind === 'draft')
  if (draft !== undefined && draft.kind === 'draft' && atMs >= draft.atMs + (draft.durationMs ?? DRAFT_MS)) {
    amber = false
  }
  if (amber) {
    return 'warning'
  }
  return flights.some((flight) => flight.size === 'beat' && arrivalOf(flight) <= atMs) ? 'success' : 'idle'
}

/**
 * Work out everything to draw at one instant.
 *
 * Nothing is remembered between frames: every value is read out of the script
 * and the moment asked for, which is what lets the same scene record
 * identically anywhere.
 *
 * @param config - The world as the scene configured it.
 * @param atMs - Offset from the start of the timeline.
 * @returns The state to draw.
 * @example The seated feature of a script that docks over the first second
 * ```ts
 * embedStateAt({ ...config, script: [{ kind: 'dock', atMs: 0, durationMs: 1000 }] }, 1000).seat // 1
 * ```
 */
export function embedStateAt(config: EmbedConfig, atMs: number): EmbedState {
  const script = config.script
  const flights = flightsOf(script)
  const dock = script.find((event) => event.kind === 'dock')
  const undock = script.find((event) => event.kind === 'undock')
  const present = script.find((event) => event.kind === 'present')
  const presentAt = present !== undefined && present.kind === 'present' ? present : undefined
  const presentArrival = presentAt === undefined ? 0 : presentAt.atMs + PRESENT_DELAY_MS + (presentAt.flightMs ?? EVENT_FLIGHT_MS)
  const links = script.filter((event) => event.kind === 'link')
  const linked = links.some((link) => link.atMs <= atMs)
  const flash = links.reduce(
    (strongest, link) => (link.kind === 'link' && link.flash !== false ? max(strongest, pulse(atMs, link.atMs, FLASH_MS)) : strongest),
    0
  )
  const gate = gateAt(script, atMs)
  const visibilities = script.filter((event) => event.kind === 'visibility').sort((a, b) => a.atMs - b.atMs)
  let dim = 0
  let eyeClosed = false
  for (const event of visibilities) {
    if (event.kind === 'visibility' && event.atMs <= atMs) {
      const eased = easeInOut(progress(atMs, event.atMs, DIM_MS))
      dim = event.hidden ? eased : 1 - eased
      eyeClosed = event.hidden
    }
  }
  const firstVisibility = visibilities[0]
  const receipt = flights.reduce(
    (strongest, flight) =>
      flight.label !== undefined && flight.from === 'feature'
        ? max(strongest, easeOut(progress(atMs, arrivalOf(flight), POP_MS)))
        : strongest,
    0
  )
  const closes = script.filter((event) => event.kind === 'close')
  return {
    seat: dock === undefined || dock.kind !== 'dock' ? 1 : easeInOut(progress(atMs, dock.atMs, dock.durationMs ?? DOCK_MS)),
    presence:
      undock === undefined || undock.kind !== 'undock' ? 1 : 1 - easeInOut(progress(atMs, undock.atMs, undock.durationMs ?? UNDOCK_MS)),
    dim,
    eye: firstVisibility === undefined ? 0 : easeOut(progress(atMs, firstVisibility.atMs, DIM_MS)),
    eyeClosed,
    linked,
    flash,
    wire: !linked ? 'dashed' : gate?.closed === true ? 'rule' : gate?.partial === true ? 'warning' : 'accent',
    gate,
    bracket: presentAt === undefined ? 0 : easeOut(progress(atMs, presentAt.atMs, BRACKET_MS)),
    present: presentAt === undefined ? undefined : { width: presentAt.width, height: presentAt.height },
    fit: presentAt === undefined ? 1 : easeOut(progress(atMs, presentArrival, FIT_MS)),
    lamp: lampAt(script, flights, atMs),
    portGlow: glowAt(flights, 'feature', atMs),
    socketGlow: glowAt(flights, 'host', atMs),
    ring: ringAt(script, flights, atMs),
    draft: draftAt(script, atMs),
    flights: flights
      .filter((flight) => atMs >= flight.departMs && atMs < arrivalOf(flight))
      .map((flight) => ({ flight, t: easeInOut(progress(atMs, flight.departMs, flight.flightMs)) })),
    receipt,
    press: closes.reduce((strongest, close) => max(strongest, pulse(atMs, close.atMs, PRESS_MS)), 0),
    closeChip: closes.length > 0,
  }
}

/**
 * When the last thing the script does has settled.
 *
 * @param config - The world as the scene configured it.
 * @returns The offset at which nothing is still moving.
 * @example A script whose only event is a beat leaving at zero
 * ```ts
 * settledAt({ ...config, script: [{ kind: 'beat', atMs: 0 }] }) // 1050
 * ```
 */
export function settledAt(config: EmbedConfig): number {
  let latest = 0
  for (const flight of flightsOf(config.script)) {
    latest = max(latest, arrivalOf(flight) + GLOW_MS)
  }
  for (const event of config.script) {
    if (event.kind === 'dock') {
      latest = max(latest, event.atMs + (event.durationMs ?? DOCK_MS))
    } else if (event.kind === 'undock') {
      latest = max(latest, event.atMs + (event.durationMs ?? UNDOCK_MS))
    } else if (event.kind === 'gate') {
      latest = max(latest, event.atMs + (event.durationMs ?? GATE_MS))
    } else if (event.kind === 'draft') {
      latest = max(latest, event.atMs + (event.durationMs ?? DRAFT_MS) + POP_MS)
    } else if (event.kind === 'present') {
      latest = max(latest, event.atMs + PRESENT_DELAY_MS + (event.flightMs ?? EVENT_FLIGHT_MS) + FIT_MS)
    } else if (event.kind === 'message') {
      latest = max(latest, event.atMs + (event.flightMs ?? EVENT_FLIGHT_MS) + POP_MS)
    } else if (event.kind === 'link') {
      latest = max(latest, event.atMs + FLASH_MS)
    } else {
      latest = max(latest, event.atMs + BLINK_MS)
    }
  }
  return latest
}
