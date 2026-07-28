import type { IAction } from './action'
import type { ChannelJSON } from './channel'
import type { IChannelContract } from './contract'
import type { SecurityProtocolVersion } from './security'

/**
 * Channel lifecycle event types
 */
export type ChannelEvent =
  | 'open'
  | 'closing'
  | 'close'
  | 'cancel'
  | 'deny'
  | 'invalid'
  | 'connect-timeout'
  | 'security-negotiated'
  | 'security-ready'
  | 'security-error'

/**
 * Data payload for OPEN event
 */
export interface OpenEventData {
  /** Origin of the connected channel */
  origin: string
  /** Negotiated channel contract */
  contract: IChannelContract
}

/**
 * Data payload for CLOSING event
 */
export interface ClosingEventData {
  /** Whether this side initiated the polite close (`false` when the counterpart proposed it) */
  initiatedLocally: boolean
}

/**
 * Data payload for CLOSE event
 */
export interface CloseEventData {
  /** Whether remote end was notified */
  notify: boolean
}

/**
 * Data payload for CANCEL event
 */
export interface CancelEventData {
  /** Whether remote end was notified */
  notify: boolean
}

/**
 * Data payload for DENY event
 */
export interface DenyEventData {
  /** Human-readable error explaining the denial */
  error?: string
  /** Machine-readable denial reason (e.g. 'security-unavailable' when a fail-closed channel could not negotiate encryption) */
  reason?: string
  /** Origin of the counterpart that denied the connection */
  origin?: string
}

/**
 * Data payload for INVALID event
 */
export interface InvalidEventData {
  /** Error message describing what was invalid */
  error: string
  /** The invalid action that was received (if available) */
  action?: IAction
}

/**
 * Data payload for CONNECT_TIMEOUT event
 */
export interface ConnectTimeoutEventData {
  /** Milliseconds elapsed since the connection attempt started */
  elapsedMs: number
}

/**
 * Data payload for SECURITY_NEGOTIATED event
 */
export interface SecurityNegotiatedEventData {
  /** Negotiated security protocol */
  protocol: SecurityProtocolVersion
  /** Whether this was the preferred protocol */
  isPreferred: boolean
}

/**
 * Data payload for SECURITY_READY event
 */
export interface SecurityReadyEventData {
  /** Active security protocol */
  protocol: SecurityProtocolVersion
  /** Whether security is active (true for v1/v2, false for 'none') */
  active: boolean
}

/**
 * Data payload for SECURITY_ERROR event
 */
export interface SecurityErrorEventData {
  /** Error message */
  message: string
  /** Error code for programmatic handling */
  code: 'decryption_failed' | 'deobfuscation_failed' | 'transport_error' | 'unknown'
  /** Original error (if available) */
  cause?: Error
}

/**
 * Carrier shape for a single broker event: a discriminator (`event`) plus its
 * typed payload (`data`). Reused by every variant in {@link EventData}.
 *
 * @template TEvent - String literal naming the event
 * @template TData - Concrete payload type for that event
 */
type EventEnvelope<TEvent extends string, TData> = {
  /** Event type */
  event: TEvent
  /** Event payload */
  data: TData
}

/**
 * Discriminated union of all event data types
 */
export type EventData =
  | EventEnvelope<'open', OpenEventData>
  | EventEnvelope<'closing', ClosingEventData>
  | EventEnvelope<'close', CloseEventData>
  | EventEnvelope<'cancel', CancelEventData>
  | EventEnvelope<'deny', DenyEventData>
  | EventEnvelope<'invalid', InvalidEventData>
  | EventEnvelope<'connect-timeout', ConnectTimeoutEventData>
  | EventEnvelope<'security-negotiated', SecurityNegotiatedEventData>
  | EventEnvelope<'security-ready', SecurityReadyEventData>
  | EventEnvelope<'security-error', SecurityErrorEventData>

/**
 * Type-safe event handler for OPEN events
 */
export type OpenEventHandler = (event: 'open', data: OpenEventData, channel: ChannelJSON) => void

/**
 * Type-safe event handler for CLOSING events
 */
export type ClosingEventHandler = (event: 'closing', data: ClosingEventData, channel: ChannelJSON) => void

/**
 * Type-safe event handler for CLOSE events
 */
export type CloseEventHandler = (event: 'close', data: CloseEventData, channel: ChannelJSON) => void

/**
 * Type-safe event handler for CANCEL events
 */
export type CancelEventHandler = (event: 'cancel', data: CancelEventData, channel: ChannelJSON) => void

/**
 * Type-safe event handler for DENY events
 */
export type DenyEventHandler = (event: 'deny', data: DenyEventData, channel: ChannelJSON) => void

/**
 * Type-safe event handler for INVALID events
 */
export type InvalidEventHandler = (event: 'invalid', data: InvalidEventData, channel: ChannelJSON) => void

/**
 * Type-safe event handler for CONNECT_TIMEOUT events
 */
export type ConnectTimeoutEventHandler = (event: 'connect-timeout', data: ConnectTimeoutEventData, channel: ChannelJSON) => void

/**
 * Type-safe event handler for SECURITY_NEGOTIATED events
 */
export type SecurityNegotiatedEventHandler = (event: 'security-negotiated', data: SecurityNegotiatedEventData, channel: ChannelJSON) => void

/**
 * Type-safe event handler for SECURITY_READY events
 */
export type SecurityReadyEventHandler = (event: 'security-ready', data: SecurityReadyEventData, channel: ChannelJSON) => void

/**
 * Type-safe event handler for SECURITY_ERROR events
 */
export type SecurityErrorEventHandler = (event: 'security-error', data: SecurityErrorEventData, channel: ChannelJSON) => void

/**
 * Union of all typed event handlers
 */
export type TypedEventHandler =
  | OpenEventHandler
  | ClosingEventHandler
  | CloseEventHandler
  | CancelEventHandler
  | DenyEventHandler
  | InvalidEventHandler
  | ConnectTimeoutEventHandler
  | SecurityNegotiatedEventHandler
  | SecurityReadyEventHandler
  | SecurityErrorEventHandler

/**
 * Simplified callback for OPEN events (event name omitted)
 */
export type OpenCallback = (data: OpenEventData, channel: ChannelJSON) => void

/**
 * Simplified callback for CLOSING events (event name omitted)
 */
export type ClosingCallback = (data: ClosingEventData, channel: ChannelJSON) => void

/**
 * Simplified callback for CLOSE events (event name omitted)
 */
export type CloseCallback = (data: CloseEventData, channel: ChannelJSON) => void

/**
 * Simplified callback for CANCEL events (event name omitted)
 */
export type CancelCallback = (data: CancelEventData, channel: ChannelJSON) => void

/**
 * Simplified callback for DENY events (event name omitted)
 */
export type DenyCallback = (data: DenyEventData, channel: ChannelJSON) => void

/**
 * Simplified callback for INVALID events (event name omitted)
 */
export type InvalidCallback = (data: InvalidEventData, channel: ChannelJSON) => void

/**
 * Simplified callback for CONNECT_TIMEOUT events (event name omitted)
 */
export type ConnectTimeoutCallback = (data: ConnectTimeoutEventData, channel: ChannelJSON) => void

/**
 * Simplified callback for SECURITY_NEGOTIATED events (event name omitted)
 */
export type SecurityNegotiatedCallback = (data: SecurityNegotiatedEventData, channel: ChannelJSON) => void

/**
 * Simplified callback for SECURITY_READY events (event name omitted)
 */
export type SecurityReadyCallback = (data: SecurityReadyEventData, channel: ChannelJSON) => void

/**
 * Simplified callback for SECURITY_ERROR events (event name omitted)
 */
export type SecurityErrorCallback = (data: SecurityErrorEventData, channel: ChannelJSON) => void

/**
 * Maps event names to their simplified callback types.
 * Used for type-safe on(event, handler) overloads.
 */
export interface EventCallbackMap {
  /** Callback for open events */
  open: OpenCallback
  /** Callback for closing events */
  closing: ClosingCallback
  /** Callback for close events */
  close: CloseCallback
  /** Callback for cancel events */
  cancel: CancelCallback
  /** Callback for deny events */
  deny: DenyCallback
  /** Callback for invalid events */
  invalid: InvalidCallback
  /** Callback for connect-timeout events */
  'connect-timeout': ConnectTimeoutCallback
  /** Callback for security-negotiated events */
  'security-negotiated': SecurityNegotiatedCallback
  /** Callback for security-ready events */
  'security-ready': SecurityReadyCallback
  /** Callback for security-error events */
  'security-error': SecurityErrorCallback
}
