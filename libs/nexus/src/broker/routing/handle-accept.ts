import type { IAction, IActionBase } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { SecurityNegotiationResponse, SecurityConfirmation } from '../../types/security'
import type { RoutingContext } from './types'
import { validateContract } from '../../core/validation/contract'
import { isActionWithContract } from '../../types/action'
import { findMissingRequiredActions } from '../../utils/validation/find-missing-required-actions'
import { applyPolicy } from '../security/apply-policy'
import { resolveChannel } from './resolve-channel'

/**
 * Handles ACCEPT_CONNECTION action.
 * Completes connection handshake from the initiator's side.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the ACCEPT_CONNECTION action
 *
 * @remarks
 * Side Effects:
 * - Replays OPEN for duplicate ACCEPTs from the connected counterpart
 * - Drops ACCEPTs whose origin does not match an already pinned origin
 * - Cancels the connection on invalid or incompatible responder contracts
 * - Pins the origin, activates the channel (own contract stays authoritative),
 *   sends OPEN, flushes the queue, and fires the 'open' event
 * - Extracts and stores the negotiated security protocol (if present)
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
      channel.sendAction({
        type: '[nexus] connection-opened',
        processId,
        senderId: state.id,
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

  let securityConfirmation: SecurityConfirmation | undefined = undefined
  if (securityResponse) {
    const negotiatedProtocol = securityResponse.negotiated

    channel.setNegotiatedProtocol(negotiatedProtocol)

    logger.info(`${state.name} accepted security protocol: ${negotiatedProtocol}`)

    if (negotiatedProtocol === 'none') {
      channel.setSecurityReady(true)
    }

    securityConfirmation = {
      active: negotiatedProtocol !== 'none',
      protocol: negotiatedProtocol,
    }
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
