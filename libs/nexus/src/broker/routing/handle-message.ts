import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { IMessage } from '../../types/message'
import type { RoutingContext } from './types'
import { validateMessage } from '../../schema/validate/message'
import { isActionWithData } from '../../types/action'
import { isPeerInstance } from './peer-instance'
import { resolveChannel } from './resolve-channel'

/**
 * Handles NEW_MESSAGE action.
 * Routes messages to the channel registered for the sending window.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the NEW_MESSAGE action
 *
 * @remarks
 * Side Effects:
 * - Drops and logs messages from an instance other than the connected
 *   counterpart, so traffic left over from a reloaded document cannot enter
 *   the session that replaced it
 * - Validates the message shape against the message schema
 * - Drops and logs messages whose type is not accepted by the channel contract
 * - Invokes channel message handlers if validation passes
 *
 * @example Routing user messages
 * User message flow:
 * channel.send('USER_LOGIN', {userId: 123})
 * -> NEW_MESSAGE action sent
 * -> Received by remote broker (this handler)
 * -> Routed to channel's onMessage handlers
 */
export function handleMessage(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { state, registry, logger } = context
  const action = message.data

  if (!isActionWithData(action)) {
    return
  }

  const messageData = <IMessage>action.data

  const channel = <ChannelHandle | undefined>resolveChannel(registry, message)

  if (!channel || !channel.isActive()) {
    return
  }

  if (!isPeerInstance(channel, action)) {
    logger.info(`${state.name} dropped a message from an instance other than the ${channel.getName()} channel's counterpart`)
    return
  }

  const validationResult = validateMessage(messageData)
  if (!validationResult.valid) {
    logger.info(`${state.name} ignored message from ${channel.getName()}`)
    return
  }

  if (!channel.getAcceptedTypes().includes(messageData.type)) {
    logger.info(`${state.name} dropped message type '${messageData.type}' not accepted by the ${channel.getName()} channel contract`)
    return
  }

  channel.notifyMessage(messageData)
}
