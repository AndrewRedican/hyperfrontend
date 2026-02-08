import type { IChannelContract } from './contract'
import type { IAction } from './action'
import type { ChannelJSON } from './channel'

/**
 * Channel lifecycle event types
 */
export type ChannelEvent =
  | 'open' // Channel successfully opened
  | 'close' // Channel closed gracefully
  | 'cancel' // Connection cancelled
  | 'deny' // Connection denied
  | 'invalid' // Invalid request received

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
 * Discriminated union of all event data types
 */
export type EventData =
  | { event: 'open'; data: OpenEventData }
  | { event: 'close'; data: CloseEventData }
  | { event: 'cancel'; data: CancelEventData }
  | { event: 'deny'; data: DenyEventData }
  | { event: 'invalid'; data: InvalidEventData }

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
 * Union of all typed event handlers
 */
export type TypedEventHandler = OpenEventHandler | CloseEventHandler | CancelEventHandler | DenyEventHandler | InvalidEventHandler
