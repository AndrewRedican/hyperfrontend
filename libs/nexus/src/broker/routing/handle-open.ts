import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { SecurityConfirmation } from '../../types/security'
import type { RoutingContext } from './types'
import { requestsSecurity, requiresSecurity } from '../../security/settings'
import { attachSecurityTransport } from './attach-security-transport'

/**
 * Refuses to activate the channel because it is fail-closed and the
 * initiator's OPEN confirmed a plaintext outcome.
 *
 * Clears the pending activation and its ACCEPT replay timers, cancels the
 * connection on the counterpart's side, and surfaces a deny event with
 * reason 'security-unavailable'.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param channel - Channel whose activation is refused
 * @param processId - Process id of the refused connection attempt
 * @param origin - Origin of the counterpart's OPEN event
 */
function refuseSecurityUnavailable(context: RoutingContext, channel: ChannelHandle, processId: string, origin: string): void {
  const { state, logger } = context

  channel.cancel(false)
  channel.sendAction({
    type: '[nexus] connection-request-cancelled',
    processId,
    senderId: state.id,
  })

  logger.warn(`${state.name} refused to open the ${channel.getName()} channel: security is required but unavailable.`)

  channel.notifyEvent('deny', {
    error: 'Security is required for this channel but the counterpart could not activate an encrypted protocol.',
    reason: 'security-unavailable',
    origin,
  })
}

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
 * - Stores the security outcome the initiator confirmed, downgrading the
 *   recorded protocol to plaintext when the confirmation is inactive or the
 *   local provider is missing
 * - Attaches the security transport for an active confirmation before the
 *   queue flushes so queued product traffic leaves encrypted
 * - Refuses activation with a deny event, reason 'security-unavailable',
 *   when the channel is fail-closed and the confirmed outcome is plaintext
 *   (or the confirmation is absent); falls back to plaintext with a warning
 *   otherwise
 * - Marks security as ready and fires 'security-ready' when an encrypted
 *   transport is active
 * - Activates the channel from the pending activation recorded at ACCEPT
 *   time, clears the handshake timers, and flushes the outbound queue
 * - Fires 'open' lifecycle event on responder's side
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

  if (!channel.isAwaitingOpen()) {
    return
  }

  const securitySettings = channel.getSecuritySettings()

  if (securityConfirmation) {
    // why: The initiator's confirmation is the authority on the handshake's final security outcome; an inactive confirmation means it fell back to plaintext.
    let confirmedProtocol = securityConfirmation.active ? securityConfirmation.protocol : 'none'
    channel.setNegotiatedProtocol(confirmedProtocol)

    if (confirmedProtocol !== 'none' && !attachSecurityTransport(context, channel, confirmedProtocol, <string>channel.getPeerId())) {
      // why: The counterpart confirmed encryption but no local provider is registered for the protocol, so the outcome degrades to plaintext.
      logger.warn(`${state.name} has no provider registered for the negotiated '${confirmedProtocol}' protocol.`)
      confirmedProtocol = 'none'
      channel.setNegotiatedProtocol('none')
    }

    if (confirmedProtocol === 'none') {
      if (requiresSecurity(securitySettings)) {
        refuseSecurityUnavailable(context, channel, processId, message.origin)
        return
      }
      if (requestsSecurity(securitySettings)) {
        logger.warn(
          `${state.name} requested security for channel ${channel.getName()} but the counterpart confirmed a plaintext outcome; continuing without encryption.`
        )
      }
      channel.setSecurityReady(true)
    } else {
      channel.setSecurityReady(true)
      channel.notifyEvent('security-ready', { protocol: confirmedProtocol, active: true })
    }

    logger.info(`${state.name} security ready: protocol=${confirmedProtocol}, active=${confirmedProtocol !== 'none'}`)
  } else if (requiresSecurity(securitySettings)) {
    // why: A counterpart that predates security sends OPEN without a confirmation; fail-closed channels must refuse that plaintext outcome.
    refuseSecurityUnavailable(context, channel, processId, message.origin)
    return
  } else {
    channel.setSecurityReady(true)
  }

  channel.completeScheduledOpen()

  channel.notifyEvent('open', { origin: message.origin, contract: channel.getPeerContract() })
}
