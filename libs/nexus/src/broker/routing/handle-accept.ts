import type { IAction, IActionBase } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { SecurityNegotiationResponse, SecurityConfirmation } from '../../types/security'
import type { RoutingContext } from './types'
import { validateContract } from '../../core/validation/contract'
import { isActionWithContract } from '../../types/action'
import { applyPolicy } from '../security/apply-policy'

/**
 * Handles ACCEPT_CONNECTION action.
 * Completes connection handshake from the initiator's side.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the ACCEPT_CONNECTION action
 *
 * @remarks
 * Side Effects:
 * - Activates the channel
 * - Extracts negotiated security protocol (if present)
 * - Stores negotiated protocol in channel state
 * - Sends OPEN_CONNECTION to complete handshake (with security confirmation)
 * - Terminates process after activation
 * - Fires 'open' lifecycle event
 *
 * @example
 * Second step of three-way handshake:
 * Initiator <- ACCEPT (this handler) <- Responder
 * Initiator -> OPEN -> Responder
 */
export function handleAccept(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { state, processManager, logger } = context
  const action = message.data

  if (!isActionWithContract(action)) {
    return
  }

  const processId = action.processId
  const contract = action.contract

  const securityResponse = <SecurityNegotiationResponse | undefined>(<IActionBase>action).security

  const channel = <ChannelHandle | undefined>processManager.get(processId)

  if (!channel) {
    return
  }

  if (channel.isActive()) {
    return
  }

  try {
    validateContract(contract)
  } catch {
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
      channel.sendAction({
        type: '[nexus] connection-request-cancelled',
        processId,
        senderId: state.id,
      })
      return
    }
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

  channel.activate(message.origin, contract)

  channel.sendAction({
    type: '[nexus] connection-opened',
    processId,
    senderId: state.id,
    ...(securityConfirmation && { security: securityConfirmation }),
  })

  processManager.remove(processId)

  channel.notifyEvent('open', { origin: message.origin, contract })
}
