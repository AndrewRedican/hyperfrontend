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
 * - Terminates the connection process
 * - Extracts security confirmation (if present)
 * - Marks security as ready if security is active
 * - Fires 'open' lifecycle event on responder's side
 * - Fires 'security-ready' event if security transport is active
 *
 * @example
 * Final step of three-way handshake:
 * Responder receives OPEN (this handler) from Initiator
 * Both sides now have active connection
 */
export function handleOpen(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { state, processManager, logger } = context
  const action = message.data
  const processId = <string>(<Record<string, unknown>>(<unknown>action))['processId']

  // Extract security confirmation (may be undefined for backward compatibility)
  const securityConfirmation = <SecurityConfirmation | undefined>(<Record<string, unknown>>(<unknown>action))['security']

  // Get channel by process ID
  const channel = <ChannelHandle | undefined>processManager.get(processId)

  if (!channel) {
    return // Channel not found
  }

  // Terminate process (handshake complete)
  processManager.remove(processId)

  // Handle security confirmation if present
  if (securityConfirmation) {
    // Store negotiated protocol if not already set
    if (!channel.getNegotiatedProtocol()) {
      channel.setNegotiatedProtocol(securityConfirmation.protocol)
    }

    // Mark security as ready
    channel.setSecurityReady(true)

    logger.info(`${state.name} security ready: protocol=${securityConfirmation.protocol}, active=${securityConfirmation.active}`)

    // Emit security-ready event
    channel.notifyEvent('security-ready', {
      protocol: securityConfirmation.protocol,
      active: securityConfirmation.active,
    })
  } else {
    // No security - mark as ready (passthrough mode)
    channel.setSecurityReady(true)
  }

  // Notify OPENED event to subscribers
  channel.notifyEvent('open', { origin: message.origin })
}
