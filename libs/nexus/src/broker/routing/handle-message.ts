import type { IAction } from '../../types/action'
import { isActionWithData } from '../../types/action'
import type { IMessage } from '../../types/message'
import type { BrokerState } from '../types'
import type { Registry } from '../../core/registry/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { ActionCreators } from '../../core/actions/factory'
import type { ChannelHandle } from '../../types/channel'
import { getById } from '../../core/registry/get-by-id'
import { validateAction } from '../../core/validation/action'

/**
 * Handles NEW_MESSAGE action
 * Routes messages to appropriate channel
 *
 * @param state - Current broker state
 * @param registry - Channel registry for accessing channels
 * @param processManager - Process manager for tracking communication processes
 * @param actions - Action creators for generating responses
 * @param message - Message event containing the NEW_MESSAGE action
 *
 * @remarks
 * Side Effects:
 * - Validates message type against contract
 * - Invokes channel message handlers if validation passes
 * - Logs and ignores invalid messages (in debug mode)
 *
 * @example
 * User message flow:
 * channel.send('USER_LOGIN', {userId: 123})
 * -> NEW_MESSAGE action sent
 * -> Received by remote broker (this handler)
 * -> Routed to channel's onMessage handlers
 */
export function handleMessage(
  state: BrokerState,
  registry: Registry,
  processManager: ProcessManager,
  actions: ActionCreators,
  message: MessageEvent<IAction>
): void {
  const action = message.data
  const senderId = <string>action.senderId

  // Use type guard to safely access data property
  if (!isActionWithData(action)) {
    return // Invalid action structure for message
  }

  const messageData = action.data as IMessage

  // Get channel by sender ID
  const channel = getById(registry, senderId) as ChannelHandle | undefined

  if (!channel || !channel.isActive()) {
    return // Channel not found or not open
  }

  // Validate message against contract
  try {
    // validateAction checks if the message type is in the accepted contract
    validateAction(messageData)
  } catch {
    // Invalid message - log and ignore
    if (state.settings.debug) {
      console.info(`[nexus] ${state.name} ignored message from ${channel.getName()}`)
    }
    return
  }

  // Forward to channel's message handlers
  channel.notifyMessage(messageData)
}
