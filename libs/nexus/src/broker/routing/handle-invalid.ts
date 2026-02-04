import type { IAction } from '../../types/action'
import { isActionWithProcess } from '../../types/action'
import type { BrokerState } from '../types'
import type { Registry } from '../../core/registry/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { ActionCreators } from '../../core/actions/factory'
import type { ChannelHandle } from '../../types/channel'

/**
 * Handles INVALID_REQUEST action
 * Processes error responses from remote broker
 *
 * @param state - Current broker state
 * @param registry - Channel registry for accessing channels
 * @param processManager - Process manager for tracking communication processes
 * @param actions - Action creators for generating responses
 * @param message - Message event containing the INVALID_REQUEST action
 *
 * @remarks
 * Side Effects:
 * - Fires 'invalid' lifecycle event with error details
 *
 * @example
 * Protocol violation detected:
 * Initiator sends malformed action
 * Responder detects violation
 * Initiator <- INVALID_REQUEST (this handler)
 * Initiator fires 'invalid' event with reason
 */
export function handleInvalid(
  state: BrokerState,
  registry: Registry,
  processManager: ProcessManager,
  actions: ActionCreators,
  message: MessageEvent<IAction>
): void {
  const action = message.data

  // Use type guard to safely access processId
  if (!isActionWithProcess(action)) {
    return // Invalid action structure
  }

  const processId = action.processId

  // Get channel by process ID
  const channel = processManager.get(processId) as ChannelHandle | undefined

  if (!channel) {
    return // Channel not found
  }

  // Extract error details
  const reason = (<unknown>action)['error'] as string | undefined

  // Notify INVALID event with error details
  channel.notifyEvent('invalid', { reason, origin: message.origin })
}
