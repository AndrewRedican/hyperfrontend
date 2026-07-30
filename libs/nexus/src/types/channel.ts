import type { Logger, LogLevel } from '@hyperfrontend/logging'
import type { IAction } from './action'
import type { ContractCompat, IChannelContract } from './contract'
import type { ChannelEvent, EventCallbackMap } from './events'
import type { IMessage } from './message'
import type {
  SecurityProtocolVersion,
  SecurityTransport,
  SecurityNegotiationRequest,
  SecurityNegotiationResponse,
  ChannelSecuritySettings,
} from './security'

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
  /** Minimum log level to emit (default: 'error') */
  logLevel?: LogLevel
  /** Custom logger instance to use */
  logger?: Logger
  /** Whether the channel is managed by a broker */
  brokerManaged?: boolean
  /** Security settings for protocol negotiation and encryption */
  security?: ChannelSecuritySettings
  /** Rule deciding whether the local and counterpart contracts may interoperate; an incompatible pair is denied during the handshake */
  contractCompat?: ContractCompat
  /** Milliseconds a connection attempt may remain unanswered before firing 'connect-timeout' (default: 10000) */
  connectTimeoutMs?: number
  /** Milliseconds between handshake re-sends while a connection attempt is pending (default: 500) */
  requestRetryMs?: number
  /** Milliseconds a polite close waits for the counterpart's acknowledgement before closing anyway (default: 2000) */
  closeTimeoutMs?: number
}

/**
 * Scheduled activation data for pending connections.
 * Tuple containing: [senderId, origin, contract, processId, security]
 * where `security` is the negotiated response the ACCEPT answers with
 * (absent when the request carried no security negotiation).
 */
export type ScheduledActivation = readonly [
  senderId: string,
  origin: string,
  contract: IChannelContract,
  processId: string,
  security?: SecurityNegotiationResponse,
]

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
  /** Contract declared by the connected counterpart (null before handshake completes) */
  readonly peerContract: IChannelContract | null
  /** Broker id of the connected counterpart (null before handshake completes) */
  readonly peerId: string | null
  /** Process id of our own outstanding connection request (null when not requesting) */
  readonly pendingProcessId: string | null
  /** Connection data held while waiting for the counterpart's OPEN (null when not responding) */
  readonly pendingAccept: ScheduledActivation | null
  /** Interval handle re-sending the pending handshake message (null when idle) */
  readonly retryTimer: ReturnType<typeof setInterval> | null
  /** Timeout handle enforcing the connection deadline (null when idle) */
  readonly deadlineTimer: ReturnType<typeof setTimeout> | null
  /** Milliseconds a connection attempt may remain unanswered before firing 'connect-timeout' */
  readonly connectTimeoutMs: number
  /** Milliseconds between handshake re-sends while a connection attempt is pending */
  readonly requestRetryMs: number
  /** Process id of our own outstanding polite close (null when not closing) */
  readonly closingProcessId: string | null
  /** Timeout handle bounding the wait for the close acknowledgement (null when idle) */
  readonly closeTimer: ReturnType<typeof setTimeout> | null
  /** Milliseconds a polite close waits for the counterpart's acknowledgement before closing anyway */
  readonly closeTimeoutMs: number
  /** Whether to queue messages when channel is closed */
  readonly queueMessages: boolean
  /** Logger instance for this channel (null if not configured) */
  readonly logger: Logger | null
  /** Whether channel was created by a broker */
  readonly brokerManaged: boolean
  /** Security settings configured for this channel (null when none were provided) */
  readonly security: ChannelSecuritySettings | null
  /** Contract-compatibility rule applied during the handshake (null when none was provided) */
  readonly contractCompat: ContractCompat | null
  /** Whether connect() has been called (ready to accept connections) */
  readonly readyToConnect: boolean
  /** Negotiated security protocol (null before negotiation) */
  readonly negotiatedProtocol: SecurityProtocolVersion | null
  /** Whether security transport is ready for secure messages */
  readonly securityReady: boolean
  /** Security transport adapter (null if protocol is 'none' or not negotiated) */
  readonly securityTransport: SecurityTransport | null
  /** Pending security negotiation request from initiator (for responder to use) */
  readonly pendingSecurityRequest: SecurityNegotiationRequest | null
  /** Process id of the handshake whose denial already fired the local 'deny' event (null when none) */
  readonly notifiedDenyProcessId: string | null
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
  /** Contract declared by the connected counterpart */
  peerContract: IChannelContract | null
  /** Broker id of the connected counterpart */
  peerId: string | null
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
  /** Check if a polite close is in flight (CLOSE sent, acknowledgement pending) */
  isClosing(): boolean
  /** Get the currently pinned origin ('*' or null when unpinned) */
  getOrigin(): string | null
  /** Get the broker id of the connected counterpart (null before handshake completes) */
  getPeerId(): string | null
  /** Get the contract declared by the connected counterpart (null before handshake completes) */
  getPeerContract(): IChannelContract | null
  /** Get the process id of our own outstanding connection request (null when not requesting) */
  getPendingProcessId(): string | null
  /** Get the message types this channel accepts from its counterpart (empty before activation) */
  getAcceptedTypes(): readonly string[]
  /** Get channel as serializable JSON */
  toJSON(): ChannelJSON

  /** Initiate connection handshake */
  connect(): void
  /** Gracefully disconnect channel */
  disconnect(notify?: boolean): void
  /**
   * Ends the active session because the target window now hosts a different
   * instance of the counterpart (a reload or in-frame navigation): closes
   * silently — the instance the session belonged to is already gone — and
   * fires 'close' with `reason: 'peer-reload'` so subscribers can drop
   * session-scoped state before the new instance's handshake completes.
   * The channel stays registered and reconnectable.
   */
  endStaleSession(): void
  /** Cancel pending connection */
  cancel(notify?: boolean): void
  /** Immediately destroy channel */
  destroy(notify?: boolean): void

  /** Send a typed message */
  send(type: string, data?: unknown): void
  /** Send a raw action */
  sendAction(action: unknown): void

  /**
   * Subscribe to all channel lifecycle events.
   *
   * @example
   * channel.on((event, data) => console.log(event, data))
   */
  on(handler: EventHandler): () => void
  /**
   * Subscribe to a specific channel lifecycle event.
   *
   * @example
   * channel.on('open', (data) => console.log('Opened:', data.origin))
   */
  on<E extends ChannelEvent>(event: E, handler: EventCallbackMap[E]): () => void
  /** Subscribe to user messages */
  onMessage(handler: MessageHandler): () => void

  /**
   * Activates the channel with connection details.
   * Called when connection handshake completes.
   */
  activate(origin: string, peerContract: IChannelContract, peerId?: string): void

  /**
   * Answers an inbound connection request: pins the origin, records the
   * pending activation, sends ACCEPT, and re-sends it until OPEN arrives
   * or the connection deadline expires.
   */
  beginResponse(senderId: string, origin: string, contract: IChannelContract, processId: string, acceptAction: IAction): void

  /**
   * Abandons our own outstanding connection request: clears the handshake
   * timers and removes the pending process. Used when yielding a glare
   * tie-break or when the counterpart denies the connection.
   */
  abandonRequest(): void

  /**
   * Completes the handshake on the initiator side: clears timers, activates
   * with the counterpart's details, sends the reply action, and flushes the
   * outbound queue.
   */
  completeConnection(origin: string, peerContract: IChannelContract, peerId: string, replyAction: IAction): void

  /**
   * Completes the handshake on the responder side from the recorded pending
   * activation: clears timers, activates, and flushes the outbound queue.
   * Returns false when no activation is pending (stale or duplicate OPEN).
   */
  completeScheduledOpen(): boolean

  /**
   * Checks if channel is ready to accept connections.
   * Returns true if connect() has been called.
   */
  isReadyToConnect(): boolean

  /**
   * Checks whether the responder side sent ACCEPT and is waiting for the
   * counterpart's OPEN to activate.
   */
  isAwaitingOpen(): boolean

  /**
   * Gets the security settings configured for this channel
   * (null when none were provided).
   */
  getSecuritySettings(): ChannelSecuritySettings | null

  /**
   * Applies security settings to a channel that was created before they
   * were known (e.g. auto-created by an inbound connection request).
   * Settings already configured on the channel stay authoritative: the
   * call is a no-op when the channel has security settings.
   */
  applySecuritySettings(settings: ChannelSecuritySettings): void

  /**
   * Gets the contract-compatibility rule configured for this channel
   * (null when none was provided).
   */
  getContractCompat(): ContractCompat | null

  /**
   * Schedules activation for later when connect() is called.
   * Used when REQUEST arrives before connect() is called.
   * The optional security response is answered back in the ACCEPT.
   */
  scheduleActivation(
    senderId: string,
    origin: string,
    contract: IChannelContract,
    processId: string,
    security?: SecurityNegotiationResponse
  ): void

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

  /**
   * Records that the denial of the given handshake process fired the local
   * 'deny' event. Returns false when the process is already recorded, so a
   * retried REQUEST re-using the same process id does not fire a second
   * local event.
   */
  markDenyNotified(processId: string): boolean

  /**
   * Stores the pending security request from the initiator.
   * Used by handleRequest to preserve initiator's security preferences.
   */
  setPendingSecurityRequest(request: SecurityNegotiationRequest | null): void

  /**
   * Gets the pending security request from the initiator.
   * Used by handleRequest during negotiation.
   */
  getPendingSecurityRequest(): SecurityNegotiationRequest | null

  /**
   * Sets the negotiated security protocol.
   * Called after protocol negotiation completes.
   */
  setNegotiatedProtocol(protocol: SecurityProtocolVersion): void

  /**
   * Gets the negotiated security protocol.
   */
  getNegotiatedProtocol(): SecurityProtocolVersion | null

  /**
   * Sets the security transport adapter.
   * Called after protocol initialization.
   */
  setSecurityTransport(transport: SecurityTransport | null): void

  /**
   * Gets the security transport adapter.
   */
  getSecurityTransport(): SecurityTransport | null

  /**
   * Marks security as ready for message exchange.
   * Called when security transport is fully initialized.
   */
  setSecurityReady(ready: boolean): void

  /**
   * Checks if security transport is ready.
   */
  isSecurityReady(): boolean
}
