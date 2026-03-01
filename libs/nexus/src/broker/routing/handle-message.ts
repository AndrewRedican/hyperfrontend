import type { IAction } from '../../types/action'
import { isActionWithData } from '../../types/action'
import type { IMessage } from '../../types/message'
import type { RoutingContext } from './types'
import type { ChannelHandle } from '../../types/channel'
import { getById } from '../../core/registry/get-by-id'
import { validateMessage } from '../../schema/validate/message'

/**
 * Handles NEW_MESSAGE action.
 * Routes messages to appropriate channel.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the NEW_MESSAGE action
 *
 * @remarks
 * Side Effects:
 * - Validates message type against contract
 * - Invokes channel message handlers if validation passes
 * - Logs and ignores invalid messages
 *
 * @example
 * User message flow:
 * channel.send('USER_LOGIN', {userId: 123})
 * -> NEW_MESSAGE action sent
 * -> Received by remote broker (this handler)
 * -> Routed to channel's onMessage handlers
 */
export function handleMessage(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { state, registry, logger } = context
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

  // Validate message structure
  const validationResult = validateMessage(messageData)
  if (!validationResult.valid) {
    // Invalid message - log and ignore
    logger.info(`${state.name} ignored message from ${channel.getName()}`)
    return
  }

  // Forward to channel's message handlers
  channel.notifyMessage(messageData)
}
