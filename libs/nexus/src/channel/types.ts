import type { IAction } from '../types/action'
import type { ChannelState } from '../types/channel'
import type { ChannelEvent } from '../types/events'
import type { IMessage } from '../types/message'
import type { SecurityNegotiationRequest, SecurityNegotiationResponse, SecurityConfirmation } from '../types/security'

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
  actions: {
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
    /** Sends a new message through the channel */
    newMessage(data: unknown): IAction
    /** Reports an invalid request error */
    invalidRequest(processId: string, error: string): IAction
  }

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
  processManager: {
    /** Creates a new process and returns its ID */
    create(channel: unknown): string
    /** Removes a process by ID */
    remove(processId: string): void
  }

  /** Optional cleanup callback */
  cleanup?: () => void
}
