import type { IChannelContract } from './contract'
import type { IAction } from './action'
import type { ChannelJSON } from './channel'
import type { SecurityProtocolVersion } from './security'

/**
 * Channel lifecycle event types
 */
export type ChannelEvent =
  | 'open' // Channel successfully opened
  | 'close' // Channel closed gracefully
  | 'cancel' // Connection cancelled
  | 'deny' // Connection denied
  | 'invalid' // Invalid request received
  | 'security-negotiated' // Security protocol negotiated
  | 'security-ready' // Security transport ready for messages
  | 'security-error' // Security error occurred

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
  /** Reason for denial */
  reason: string
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
 * Discriminated union of all event data types
 */
export type EventData =
  | { event: 'open'; data: OpenEventData }
  | { event: 'close'; data: CloseEventData }
  | { event: 'cancel'; data: CancelEventData }
  | { event: 'deny'; data: DenyEventData }
  | { event: 'invalid'; data: InvalidEventData }
  | { event: 'security-negotiated'; data: SecurityNegotiatedEventData }
  | { event: 'security-ready'; data: SecurityReadyEventData }
  | { event: 'security-error'; data: SecurityErrorEventData }

/**
 * Type-safe event handler for OPEN events
 */
export type OpenEventHandler = (event: 'open', data: OpenEventData, channel: ChannelJSON) => void

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
  | CloseEventHandler
  | CancelEventHandler
  | DenyEventHandler
  | InvalidEventHandler
  | SecurityNegotiatedEventHandler
  | SecurityReadyEventHandler
  | SecurityErrorEventHandler

/**
 * Simplified callback for OPEN events (event name omitted)
 */
export type OpenCallback = (data: OpenEventData, channel: ChannelJSON) => void

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
  open: OpenCallback
  close: CloseCallback
  cancel: CancelCallback
  deny: DenyCallback
  invalid: InvalidCallback
  'security-negotiated': SecurityNegotiatedCallback
  'security-ready': SecurityReadyCallback
  'security-error': SecurityErrorCallback
}
