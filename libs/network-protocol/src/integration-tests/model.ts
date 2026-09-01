import type { Channel } from '../lib/channel/model'
import type { Data } from '../lib/data/model'
import type { ReceivePacketFn } from '../lib/receiver/model'
import type { SendPacketFn } from '../lib/sender/model'

export type { Channel }
export type { Data }
export type { SendPacketFn }
export type { ReceivePacketFn }

/**
 * Simple text message payload
 */
export interface TextMessage {
  /** Message type discriminator */
  type: 'TEXT'
  /** Text content of the message */
  content: string
}

/**
 * Ping request for connection health check
 */
export interface PingMessage {
  /** Message type discriminator */
  type: 'PING'
  /** Timestamp when ping was sent */
  timestamp: number
}

/**
 * Pong response to ping request
 */
export interface PongMessage {
  /** Message type discriminator */
  type: 'PONG'
  /** Timestamp when pong was sent */
  timestamp: number
  /** Original ping timestamp for round-trip calculation */
  originalTimestamp: number
}

/**
 * Generic data payload
 */
export interface DataMessage<T = unknown> {
  /** Message type discriminator */
  type: 'DATA'
  /** Typed data payload */
  payload: T
}

/**
 * Union of all message types
 */
export type MessagePayload = TextMessage | PingMessage | PongMessage | DataMessage

/**
 * Client interface representing a network protocol participant.
 */
export interface Client<T = MessagePayload> {
  /** Unique client identifier */
  readonly id: string
  /** Client label for logging */
  readonly label: string
  /** Check if client is connected to a peer */
  readonly isConnected: () => boolean
  /** Connect to another client (establishes bidirectional channel) */
  readonly connect: (target: Client<T>) => Client<T>
  /** Send a message to the connected peer */
  readonly send: (message: T) => Promise<Client<T>>
  /** Register a callback for incoming messages */
  readonly onMessage: (callback: MessageCallback<T>) => Client<T>
  /** Get the underlying channel (for advanced use) */
  readonly getChannel: () => Channel
  /** Disconnect from the peer */
  readonly disconnect: () => void
  /** Internal method to deliver packets from peer */
  readonly _deliverPacket: (packet: Uint8Array) => void
}

/**
 * Received packet structure - the Data wrapper contains the actual message
 */
export interface ReceivedPacket<T> {
  /** Sender identifier */
  origin: string
  /** Recipient identifier */
  target: string
  /** The data wrapper containing the message */
  data: Data<T>
}

/**
 * Callback for receiving messages
 */
export type MessageCallback<T = MessagePayload> = (packet: ReceivedPacket<T>) => void
