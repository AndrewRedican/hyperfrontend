import type { IChannelContract } from './contract'
import type { IMessage } from './message'
import type { ChannelEvent } from './events'

/**
 * Configuration for creating a new channel
 */
export interface IChannelConfig {
  /** Channel identifier/name */
  name: string
  /** Target window for postMessage communication */
  target: Window
  /** Channel behavior settings */
  settings?: IChannelSettings
}

/**
 * Channel behavior settings
 */
export interface IChannelSettings {
  /** Expected channel contract (if not set, inherited from broker) */
  contract?: IChannelContract | null
  /** Expected origin ('*' for any, or specific URL) */
  origin?: string
  /** Queue messages when channel is not yet active */
  queueMessages?: boolean
  /** Enable debug logging */
  debug?: boolean
  /** Whether the channel is managed by a broker (auto-activates on connect) */
  brokerManaged?: boolean
}

/**
 * Scheduled activation data for pending connections.
 * Tuple containing: [senderId, origin, contract, processId]
 */
export type ScheduledActivation = readonly [senderId: string, origin: string, contract: IChannelContract, processId: string]

/**
 * Event subscription callback.
 * Called when channel lifecycle events occur.
 */
export type EventHandler = (event: ChannelEvent, data?: unknown, channel?: ChannelJSON) => void

/**
 * Message subscription callback.
 * Called when user messages are received.
 */
export type MessageHandler = (message: IMessage, channel?: ChannelJSON) => void

/**
 * Internal immutable state of a channel.
 * All updates should create new state objects.
 */
export interface ChannelState {
  /** Unique channel identifier (UUID) */
  readonly id: string
  /** Channel name */
  readonly name: string
  /** Target window for communication */
  readonly target: Window
  /** Actual origin of the connected channel (null before connection) */
  readonly origin: string | null
  /** Whether channel is active/open */
  readonly active: boolean
  /** Timestamp when channel connected (null if not connected) */
  readonly connectTimestamp: number | null
  /** Channel contract (null before activation) */
  readonly contract: IChannelContract | null
  /** Cached list of accepted action types from contract */
  readonly acceptedActions: readonly string[]
  /** Messages waiting to be sent when channel opens */
  readonly queuedMessages: readonly IMessage[]
  /** Registered event handlers */
  readonly eventSubscriptions: readonly EventHandler[]
  /** Registered message handlers */
  readonly messageSubscriptions: readonly MessageHandler[]
  /** Pending connection data (null when no connection pending) */
  readonly scheduledActivation: ScheduledActivation | null
  /** Whether to queue messages when channel is closed */
  readonly queueMessages: boolean
  /** Debug mode enabled */
  readonly debug: boolean
  /** Whether channel was created by broker (enables auto-activation) */
  readonly brokerManaged: boolean
  /** Whether connect() has been called (ready to accept connections) */
  readonly readyToConnect: boolean
}

/**
 * Safe serializable representation of a channel for callbacks.
 * Contains only data, no methods or internal references.
 */
export interface ChannelJSON {
  /** Channel unique identifier */
  id: string
  /** Channel name */
  name: string
  /** Whether channel is active */
  active: boolean
  /** Origin of connected channel */
  origin: string | null
  /** When channel connected */
  connectTimestamp: number | null
  /** Channel contract */
  contract: IChannelContract | null
  /** Number of queued messages */
  queuedMessagesCount: number
}

/**
 * Channel handle returned by createChannel factory.
 * Provides methods for interacting with the channel.
 */
export interface ChannelHandle {
  /** Channel unique identifier (for registry compatibility) */
  readonly id: string
  /** Channel name (for registry compatibility) */
  readonly name: string
  /** Target window (for registry compatibility) */
  readonly target: Window

  /** Get channel ID */
  getId(): string
  /** Get channel name */
  getName(): string
  /** Get target window */
  getTarget(): Window
  /** Check if channel is active */
  isActive(): boolean
  /** Get channel as serializable JSON */
  toJSON(): ChannelJSON

  /** Initiate connection handshake */
  connect(): void
  /** Gracefully disconnect channel */
  disconnect(notify?: boolean): void
  /** Cancel pending connection */
  cancel(notify?: boolean): void
  /** Immediately destroy channel */
  destroy(notify?: boolean): void

  /** Send a typed message */
  send(type: string, data?: unknown): void
  /** Send a raw action */
  sendAction(action: unknown): void

  /** Subscribe to channel lifecycle events */
  on(handler: EventHandler): () => void
  /** Subscribe to user messages */
  onMessage(handler: MessageHandler): () => void

  // ============================================
  // Broker-internal methods (used by handlers)
  // ============================================

  /**
   * Activates the channel with connection details.
   * Called when connection handshake completes.
   */
  activate(origin: string, contract: IChannelContract): void

  /**
   * Checks if channel is ready to accept connections.
   * Returns true if connect() has been called.
   */
  isReadyToConnect(): boolean

  /**
   * Schedules activation for later when connect() is called.
   * Used when REQUEST arrives before connect() is called.
   */
  scheduleActivation(senderId: string, origin: string, contract: IChannelContract, processId: string): void

  /**
   * Notifies event subscribers of a channel event.
   * Used by broker handlers to fire lifecycle events.
   */
  notifyEvent(event: ChannelEvent, data?: unknown): void

  /**
   * Notifies message subscribers of an incoming message.
   * Used by broker handlers to forward messages.
   */
  notifyMessage(message: IMessage): void
}
