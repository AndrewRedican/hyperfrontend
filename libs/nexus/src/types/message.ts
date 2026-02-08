/**
 * User message interface for application-level communication.
 * Only 'type' is required; data and other properties are optional.
 */
export interface IMessage {
  /** Message type identifier (e.g., 'user-logged-in', 'data-updated') */
  type: string
  /** Optional payload data (must be serializable via postMessage) */
  data?: unknown
  /** Optional timestamp for when message was created */
  timestamp?: number
  /** Allow additional custom properties */
  [key: string]: unknown
}

/**
 * Internal message envelope for routing and tracking.
 * Wraps user messages with metadata for internal use.
 */
export interface MessageEnvelope {
  /** The user message being transmitted */
  message: IMessage
  /** ID of the channel handling this message */
  channelId: string
  /** Direction of message flow */
  direction: 'inbound' | 'outbound'
}
