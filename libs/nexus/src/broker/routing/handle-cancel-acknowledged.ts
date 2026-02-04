import type { IAction } from '../../types/action'
import type { BrokerState } from '../types'
import type { Registry } from '../../core/registry/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { ActionCreators } from '../../core/actions/factory'
import type { ChannelHandle } from '../../types/channel'

/**
 * Handles CANCEL_CONNECTION_ACKNOWLEDGED action
 * Completes cancellation on initiator's side and notifies cancel event
 *
 * @param state - Current broker state
 * @param registry - Channel registry for accessing channels
 * @param processManager - Process manager for tracking communication processes
 * @param actions - Action creators for generating responses
 * @param message - Message event containing the CANCEL_CONNECTION_ACKNOWLEDGED action
 *
 * @remarks
 * Side Effects:
 * - Terminates the connection process
 * - Fires 'cancel' lifecycle event on initiator's side
 *
 * @example
 * Cancellation acknowledgment (initiator side):
 * Initiator -> CANCEL_CONNECTION
 * Initiator <- CANCEL_ACKNOWLEDGED (this handler)
 * Initiator fires 'cancel' event
 */
export function handleCancelAcknowledged(
  state: BrokerState,
  registry: Registry,
  processManager: ProcessManager,
  actions: ActionCreators,
  message: MessageEvent<IAction>
): void {
  const action = message.data
  const processId = (action as unknown as Record<string, unknown>)['processId'] as string

  // Get channel by process ID
  const channel = processManager.get(processId) as ChannelHandle | undefined

  if (!channel) {
    return // Channel not found
  }

  // Terminate process
  processManager.remove(processId)

  // Notify CANCELLED event to subscribers
  channel.notifyEvent('cancel', { notify: false })
}
