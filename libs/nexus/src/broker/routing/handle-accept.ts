import type { IAction, IActionBase } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { SecurityNegotiationResponse, SecurityConfirmation } from '../../types/security'
import type { RoutingContext } from './types'
import { validateContract } from '../../core/validation/contract'
import { requestsSecurity, requiresSecurity } from '../../security/settings'
import { isActionWithContract } from '../../types/action'
import { findMissingRequiredActions } from '../../utils/validation/find-missing-required-actions'
import { applyPolicy } from '../security/apply-policy'
import { attachSecurityTransport } from './attach-security-transport'
import { resolveChannel } from './resolve-channel'

/**
 * Aborts the pending connection because the channel is fail-closed and the
 * handshake could not deliver an encrypted transport.
 *
 * Stops the request retries, cancels the counterpart's pending response,
 * and surfaces a deny event with reason 'security-unavailable'.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param channel - Channel whose connection attempt is aborted
 * @param processId - Process id of the aborted connection attempt
 * @param origin - Origin of the counterpart's ACCEPT event
 */
function abortSecurityUnavailable(context: RoutingContext, channel: ChannelHandle, processId: string, origin: string): void {
  const { state, logger } = context

  channel.abandonRequest()
  channel.sendAction({
    type: '[nexus] connection-request-cancelled',
    processId,
    senderId: state.id,
  })

  logger.warn(`${state.name} aborted the ${channel.getName()} connection: security is required but unavailable.`)

  channel.notifyEvent('deny', {
    error: 'Security is required for this channel but the counterpart cannot provide an encrypted protocol.',
    reason: 'security-unavailable',
    origin,
  })
}

/**
 * Handles ACCEPT_CONNECTION action.
 * Completes connection handshake from the initiator's side.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the ACCEPT_CONNECTION action
 *
 * @remarks
 * Side Effects:
 * - Replays OPEN (repeating the security confirmation) for duplicate
 *   ACCEPTs from the connected counterpart
 * - Drops ACCEPTs whose origin does not match an already pinned origin
 * - Cancels the connection on invalid or incompatible responder contracts
 * - Attaches the security transport for the negotiated protocol before the
 *   queue flushes, so queued product traffic leaves encrypted
 * - Aborts with reason 'security-unavailable' when the channel is
 *   fail-closed and no encrypted transport can be established; falls back
 *   to plaintext with a warning otherwise
 * - Pins the origin, activates the channel (own contract stays authoritative),
 *   sends OPEN confirming the security outcome, flushes the queue, and fires
 *   the 'open' event
 *
 * @example Three-way handshake acceptance
 * Second step of three-way handshake:
 * Initiator <- ACCEPT (this handler) <- Responder
 * Initiator -> OPEN -> Responder
 */
export function handleAccept(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { state, registry, processManager, logger } = context
  const action = message.data

  if (!isActionWithContract(action)) {
    return
  }

  const processId = action.processId
  const contract = action.contract

  const securityResponse = <SecurityNegotiationResponse | undefined>(<IActionBase>action).security

  // why: The process is removed at handshake completion, so a duplicate ACCEPT (lost OPEN) resolves by source window with the origin pin enforced.
  const channel = <ChannelHandle | undefined>processManager.get(processId) ?? <ChannelHandle | undefined>resolveChannel(registry, message)

  if (!channel) {
    return
  }

  if (channel.isActive()) {
    if (channel.getPeerId() === <string>action.senderId) {
      // why: The replayed OPEN must repeat the original security confirmation, or the responder recovering from a lost OPEN would complete a plaintext open.
      const negotiated = channel.getNegotiatedProtocol()
      channel.sendAction({
        type: '[nexus] connection-opened',
        processId,
        senderId: state.id,
        ...(negotiated && { security: { active: channel.getSecurityTransport() !== null, protocol: negotiated } }),
      })
    }
    return
  }

  const pinnedOrigin = channel.getOrigin()
  if (pinnedOrigin !== null && pinnedOrigin !== '*' && pinnedOrigin !== message.origin) {
    channel.notifyEvent('invalid', { error: `Dropped connection acceptance from unexpected origin '${message.origin}'.`, action })
    return
  }

  try {
    validateContract(contract)
  } catch {
    channel.abandonRequest()
    channel.sendAction({
      type: '[nexus] connection-request-cancelled',
      processId,
      senderId: state.id,
    })
    return
  }

  if (state.settings.securityPolicy) {
    const allowed = applyPolicy(state.settings.securityPolicy, message, logger)
    if (!allowed) {
      channel.abandonRequest()
      channel.sendAction({
        type: '[nexus] connection-request-cancelled',
        processId,
        senderId: state.id,
      })
      return
    }
  }

  if (findMissingRequiredActions(state.contract, contract).length > 0) {
    channel.abandonRequest()
    channel.sendAction({
      type: '[nexus] connection-request-cancelled',
      processId,
      senderId: state.id,
    })
    return
  }

  const securitySettings = channel.getSecuritySettings()

  let securityConfirmation: SecurityConfirmation | undefined = undefined
  if (securityResponse) {
    let negotiatedProtocol = securityResponse.negotiated

    channel.setNegotiatedProtocol(negotiatedProtocol)

    logger.info(`${state.name} accepted security protocol: ${negotiatedProtocol}`)

    if (negotiatedProtocol !== 'none' && !attachSecurityTransport(context, channel, negotiatedProtocol, <string>action.senderId)) {
      // why: The counterpart agreed to encrypt but no local provider is registered for the protocol, so the outcome degrades to plaintext.
      logger.warn(`${state.name} has no provider registered for the negotiated '${negotiatedProtocol}' protocol.`)
      negotiatedProtocol = 'none'
      channel.setNegotiatedProtocol('none')
    }

    if (negotiatedProtocol === 'none') {
      if (requiresSecurity(securitySettings)) {
        abortSecurityUnavailable(context, channel, processId, message.origin)
        return
      }
      if (requestsSecurity(securitySettings)) {
        logger.warn(
          `${state.name} requested security for channel ${channel.getName()} but negotiation ended in plaintext; continuing without encryption.`
        )
      }
      channel.setSecurityReady(true)
    } else {
      channel.setSecurityReady(true)
      channel.notifyEvent('security-ready', { protocol: negotiatedProtocol, active: true })
    }

    securityConfirmation = {
      active: negotiatedProtocol !== 'none',
      protocol: negotiatedProtocol,
    }
  } else if (requiresSecurity(securitySettings)) {
    // why: A counterpart that predates security answers ACCEPT without a security slot; fail-closed channels must refuse that plaintext outcome.
    abortSecurityUnavailable(context, channel, processId, message.origin)
    return
  } else if (requestsSecurity(securitySettings)) {
    logger.warn(
      `${state.name} requested security for channel ${channel.getName()} but the counterpart predates security negotiation; continuing without encryption.`
    )
  }

  channel.completeConnection(message.origin, contract, <string>action.senderId, {
    type: '[nexus] connection-opened',
    processId,
    senderId: state.id,
    ...(securityConfirmation && { security: securityConfirmation }),
  })

  processManager.remove(processId)

  channel.notifyEvent('open', { origin: message.origin, contract })
}
