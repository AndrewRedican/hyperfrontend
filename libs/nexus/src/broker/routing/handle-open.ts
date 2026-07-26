import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { SecurityConfirmation } from '../../types/security'
import type { RoutingContext } from './types'

/**
 * Handles OPEN_CONNECTION action.
 * Completes handshake on responder's side and notifies open event.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the OPEN_CONNECTION action
 *
 * @remarks
 * Side Effects:
 * - Terminates the connection process (duplicate OPENs no-op on the bail)
 * - Activates the channel from the pending activation recorded at ACCEPT
 *   time, clears the handshake timers, and flushes the outbound queue
 * - Extracts security confirmation (if present)
 * - Marks security as ready if security is active
 * - Fires 'open' lifecycle event on responder's side
 * - Fires 'security-ready' event if security transport is active
 *
 * @example Completing the three-way handshake
 * Final step of three-way handshake:
 * Responder receives OPEN (this handler) from Initiator
 * Both sides now have active connection
 */
export function handleOpen(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { state, processManager, logger } = context
  const action = message.data
  const processId = <string>(<Record<string, unknown>>(<unknown>action))['processId']

  const securityConfirmation = <SecurityConfirmation | undefined>(<Record<string, unknown>>(<unknown>action))['security']

  const channel = <ChannelHandle | undefined>processManager.get(processId)

  if (!channel) {
    return
  }

  processManager.remove(processId)

  if (!channel.completeScheduledOpen()) {
    return
  }

  if (securityConfirmation) {
    if (!channel.getNegotiatedProtocol()) {
      channel.setNegotiatedProtocol(securityConfirmation.protocol)
    }

    channel.setSecurityReady(true)

    logger.info(`${state.name} security ready: protocol=${securityConfirmation.protocol}, active=${securityConfirmation.active}`)

    channel.notifyEvent('security-ready', {
      protocol: securityConfirmation.protocol,
      active: securityConfirmation.active,
    })
  } else {
    channel.setSecurityReady(true)
  }

  channel.notifyEvent('open', { origin: message.origin, contract: channel.getPeerContract() })
}
