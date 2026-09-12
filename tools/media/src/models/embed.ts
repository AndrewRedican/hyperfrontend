import type { Mark } from './banner'

/** Which of the two pages a signal leaves from. */
export type EmbedSide = 'host' | 'feature'

/** What the host's watchdog says about the feature, set as the word inside the ring. */
export type EmbedStatusState = 'healthy' | 'suspect' | 'unobservable'

/** What every event on the script shares. */
export interface EmbedEventBase {
  /** When the event happens, as an offset from the start of the timeline. */
  atMs: number
}

/** The feature window slides from outside the host into the slot and seats. */
export interface EmbedDockEvent extends EmbedEventBase {
  /** Discriminant. */
  kind: 'dock'
  /** How long the slide takes. */
  durationMs?: number
}

/** The seated feature fades out of the slot, which returns to its dashed outline. */
export interface EmbedUndockEvent extends EmbedEventBase {
  /** Discriminant. */
  kind: 'undock'
  /** How long the fade takes. */
  durationMs?: number
}

/** A single glowing dot crosses the wire. */
export interface EmbedPulseEvent extends EmbedEventBase {
  /** Discriminant. */
  kind: 'pulse'
  /** Which end the dot leaves from. */
  from: EmbedSide
  /** How long the crossing takes. */
  flightMs?: number
}

/** The wire becomes a live channel: solid, in the accent. */
export interface EmbedLinkEvent extends EmbedEventBase {
  /** Discriminant. */
  kind: 'link'
  /** Whether both windows flash their active border at this moment; on by default. */
  flash?: boolean
}

/** The host measures the slot and tells the feature its size. */
export interface EmbedPresentEvent extends EmbedEventBase {
  /** Discriminant. */
  kind: 'present'
  /** Width the bracket reports, in the feature's pixels. */
  width: number
  /** Height the bracket reports, in the feature's pixels. */
  height: number
  /** How long the announcement takes to cross the wire. */
  flightMs?: number
}

/** The feature's liveness beat: a small dot feature to host, once or on a cadence. */
export interface EmbedBeatEvent extends EmbedEventBase {
  /** Discriminant. */
  kind: 'beat'
  /** Cadence of the beats after the first; a single beat when omitted. */
  everyMs?: number
  /** Last moment a beat may leave; only the first leaves when omitted. */
  untilMs?: number
  /** How long a beat takes to cross the wire. */
  flightMs?: number
}

/** One tick of the host's watchdog clock. */
export interface EmbedTickEvent extends EmbedEventBase {
  /** Discriminant. */
  kind: 'tick'
  /** Whether the silence at this tick counts: a counted tick fills one segment of the ring. */
  counted: boolean
}

/** The word inside the watchdog ring changes. */
export interface EmbedStatusEvent extends EmbedEventBase {
  /** Discriminant. */
  kind: 'status'
  /** The state the host now reports. */
  state: EmbedStatusState
}

/** The feature's tab is hidden or shown again, and it reports which to the host. */
export interface EmbedVisibilityEvent extends EmbedEventBase {
  /** Discriminant. */
  kind: 'visibility'
  /** Whether the feature's page is hidden from here on. */
  hidden: boolean
  /** How long the report takes to cross the wire. */
  flightMs?: number
}

/**
 * The feature declares whether it holds unsaved work.
 *
 * The draft it holds is drawn from the start of the timeline; this event is
 * the moment it tells the host, and the host's lamp takes the amber when the
 * report arrives.
 */
export interface EmbedDirtyEvent extends EmbedEventBase {
  /** Discriminant. */
  kind: 'dirty'
  /** Whether the feature holds unsaved work. */
  on: boolean
  /** How long the report takes to cross the wire. */
  flightMs?: number
}

/** The host presses its close button and proposes closing to the feature. */
export interface EmbedCloseEvent extends EmbedEventBase {
  /** Discriminant. */
  kind: 'close'
  /** How long the proposal takes to cross the wire. */
  flightMs?: number
}

/** The shutter across the wire descends to a new position. */
export interface EmbedGateEvent extends EmbedEventBase {
  /** Discriminant. */
  kind: 'gate'
  /** How far down the shutter ends up, from 0 (raised) to 1 (the wire is cut). */
  to: number
  /** How long the descent takes. */
  durationMs?: number
}

/** The draft leaves the feature, crosses the wire and lands in the host as a saved document. */
export interface EmbedDraftEvent extends EmbedEventBase {
  /** Discriminant. */
  kind: 'draft'
  /** How long the crossing takes. */
  durationMs?: number
}

/** An ordinary application message: a labelled dot; one from the feature pops a receipt in the host. */
export interface EmbedMessageEvent extends EmbedEventBase {
  /** Discriminant. */
  kind: 'message'
  /** Which end the message leaves from. */
  from: EmbedSide
  /** The message type, set beside the dot. */
  label: string
  /** How long the crossing takes. */
  flightMs?: number
}

/** Anything the script can say. */
export type EmbedEvent =
  | EmbedDockEvent
  | EmbedUndockEvent
  | EmbedPulseEvent
  | EmbedLinkEvent
  | EmbedPresentEvent
  | EmbedBeatEvent
  | EmbedTickEvent
  | EmbedStatusEvent
  | EmbedVisibilityEvent
  | EmbedDirtyEvent
  | EmbedCloseEvent
  | EmbedGateEvent
  | EmbedDraftEvent
  | EmbedMessageEvent

/** Everything a scene tells the embed stage. */
export interface EmbedConfig {
  /** The package's mark, drawn in every API chip. */
  mark: Mark
  /** Name of the host-side factory, set above the slot. */
  shellApi: string
  /** Name of the feature-side factory, set inside the feature window. */
  featureApi: string
  /** Name of the close call, set in the host's chrome when the script closes. */
  closeApi: string
  /** What happens, in order. */
  script: readonly EmbedEvent[]
  /** How long the frame holds after the last event settles. */
  restMs?: number
}
