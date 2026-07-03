import type { IAction } from '../types/action'
import type { ChannelState } from '../types/channel'
import type { ChannelEvent } from '../types/events'
import type { IMessage } from '../types/message'
import type { SecurityNegotiationRequest, SecurityNegotiationResponse, SecurityConfirmation } from '../types/security'

/**
 * Action creators a channel uses to talk to its broker. Each method returns the
 * `IAction` that the broker would otherwise hand-build, with arguments threaded
 * through to keep call sites readable.
 */
export interface ChannelActionCreators {
  /** Requests a connection with optional security negotiation */
  requestConnection(processId: string, security?: SecurityNegotiationRequest): IAction
  /** Accepts a pending connection request */
  acceptConnection(processId: string, security?: SecurityNegotiationResponse): IAction
  /** Denies a connection request with a reason */
  denyConnection(processId: string, reason: string): IAction
  /** Cancels an ongoing connection attempt */
  cancelConnection(processId: string): IAction
  /** Opens an established connection */
  openConnection(processId: string, security?: SecurityConfirmation): IAction
  /** Closes an active connection */
  closeConnection(processId: string): IAction
  /** Destroys the connection entirely */
  destroyConnection(): IAction
  /** Sends a new message through the channel; carries the full message as the action payload */
  newMessage(message: IMessage): IAction
  /** Reports an invalid request error */
  invalidRequest(processId: string, error: string): IAction
}

/**
 * Minimal process-tracking interface a channel needs from its host broker.
 */
export interface ChannelProcessManager {
  /** Creates a new process and returns its ID */
  create(channel: unknown): string
  /** Removes a process by ID */
  remove(processId: string): void
}

/**
 * Internal channel API used by lifecycle, messaging, and subscription functions.
 * This interface provides access to channel state and dependencies without exposing
 * the public API surface.
 */
export interface ChannelInternals {
  /** Get current immutable state */
  getState(): ChannelState

  /** Update state (merges partial state into current state) */
  updateState(partial: Partial<ChannelState>): void

  /** Send raw action via postMessage */
  sendAction(action: IAction): void

  /** Create a new process ID and track it */
  createProcess(): string

  /** Remove process tracking */
  removeProcess(processId: string): void

  /** Notify all event subscribers */
  notifyEvent(event: ChannelEvent, data?: unknown): void

  /** Notify all message subscribers */
  notifyMessage(message: IMessage): void

  /** Action creators bound to broker */
  actions: ChannelActionCreators

  /** Optional cleanup callback to remove channel from broker */
  cleanup?: () => void
}

/**
 * Dependencies required to create a channel
 */
export interface ChannelDependencies {
  /** Action creators from broker */
  actions: ChannelInternals['actions']

  /** Process manager for tracking connection processes */
  processManager: ChannelProcessManager

  /** Optional cleanup callback */
  cleanup?: () => void
}
