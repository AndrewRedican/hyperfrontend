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
 * Why a session ended, when the cause is something other than either side
 * asking for it.
 *
 * - `peer-reload`: the counterpart window now hosts a different instance
 *   (a reload or in-frame navigation), so the session it belonged to is over.
 *   The channel stays reconnectable and the new instance's handshake is
 *   already in flight.
 */
export type CloseReason = 'peer-reload'

/**
 * Data payload for CLOSE event
 */
export interface CloseEventData {
  /** Whether remote end was notified */
  notify: boolean
  /** Why the session ended, when neither side asked for the close */
  reason?: CloseReason
}

/**
 * Data payload for CANCEL event
 */
export interface CancelEventData {
  /** Whether remote end was notified */
  notify: boolean
}

/**
 * Why a handshake gate refused the connection.
 *
 * - `invalid-contract`: the counterpart's contract failed structural
 *   validation, so there is nothing to negotiate against.
 * - `missing-required-actions`: the counterpart's contract does not emit an
 *   action this side accepts as `required: true`.
 * - `policy-rejected`: the broker's `securityPolicy` refused the request.
 *   The refused counterpart is told only that it was not accepted, so this
 *   reason reaches the deciding side alone.
 * - `incompatible-contract`: a `contractCompat` rule rejected the contract
 *   pair.
 * - `security-unavailable`: a fail-closed channel could not obtain an
 *   encrypted transport.
 *
 * Any other string is accepted so a counterpart running a newer protocol can
 * report a reason this build does not know yet.
 */
export type DenyReason =
  | 'invalid-contract'
  | 'missing-required-actions'
  | 'policy-rejected'
  | 'incompatible-contract'
  | 'security-unavailable'
  | (string & {})

/**
 * Data payload for DENY event
 */
export interface DenyEventData {
  /** Human-readable error explaining the denial */
  error?: string
  /** Machine-readable denial reason */
  reason?: DenyReason
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
