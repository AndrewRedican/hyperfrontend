import type { IAction } from '../../types/action'
import type { BrokerState } from '../types'
import type { Registry } from '../../core/registry/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { ActionCreators } from '../../core/actions/factory'
import type { ChannelHandle } from '../../types/channel'

/**
 * Handles CLOSE_CONNECTION_ACKNOWLEDGED action
 * Completes close on initiator's side and notifies close event
 *
 * @param state - Current broker state
 * @param registry - Channel registry for accessing channels
 * @param processManager - Process manager for tracking communication processes
 * @param actions - Action creators for generating responses
 * @param message - Message event containing the CLOSE_CONNECTION_ACKNOWLEDGED action
 */
export function handleCloseAcknowledged(
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

  // Notify CLOSED event to subscribers
  channel.notifyEvent('close', { notify: false })
}
