import type { ChannelState } from '../types/channel'
import type { IMessage } from '../types/message'
import type { IAction } from '../types/action'
import type { ChannelEvent } from '../types/events'

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
    requestConnection(processId: string): IAction
    acceptConnection(processId: string): IAction
    denyConnection(processId: string, reason: string): IAction
    cancelConnection(processId: string): IAction
    openConnection(processId: string): IAction
    closeConnection(processId: string): IAction
    destroyConnection(): IAction
    newMessage(data: unknown): IAction
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
    create(channel: unknown): string
    remove(processId: string): void
  }

  /** Optional cleanup callback */
  cleanup?: () => void
}
