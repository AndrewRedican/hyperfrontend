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

  // Type guard to ensure action has contract and processId
  if (!isActionWithContract(action)) {
    return
  }

  const processId = action.processId
  const contract = action.contract

  // Extract security response from action base (may be undefined for backward compatibility)
  const securityResponse = <SecurityNegotiationResponse | undefined>(<IActionBase>action).security

  // Get channel by process ID
  const channel = <ChannelHandle | undefined>processManager.get(processId)

  if (!channel) {
    return // Channel not found
  }

  if (channel.isActive()) {
    return // Already open
  }

  // Validate contract
  try {
    validateContract(contract)
  } catch {
    // Invalid contract - cancel connection
    channel.sendAction({
      type: '[nexus] connection-request-cancelled',
      processId,
      senderId: state.id,
    })
    return
  }

  // Apply security policy if configured
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

  // Handle security protocol negotiation result
  let securityConfirmation: SecurityConfirmation | undefined = undefined
  if (securityResponse) {
    const negotiatedProtocol = securityResponse.negotiated

    // Store negotiated protocol in channel state
    channel.setNegotiatedProtocol(negotiatedProtocol)

    logger.info(`${state.name} accepted security protocol: ${negotiatedProtocol}`)

    // For 'none' protocol, mark security as ready immediately
    if (negotiatedProtocol === 'none') {
      channel.setSecurityReady(true)
    }

    // Create security confirmation for OPEN action
    securityConfirmation = {
      active: negotiatedProtocol !== 'none',
      protocol: negotiatedProtocol,
    }
  }

  // Activate channel with connection details
  channel.activate(message.origin, contract)

  // Send OPEN_CONNECTION with security confirmation if applicable
  channel.sendAction({
    type: '[nexus] connection-opened',
    processId,
    senderId: state.id,
    ...(securityConfirmation && { security: securityConfirmation }),
  })

  // Terminate process (handshake complete)
  processManager.remove(processId)

  // Notify OPENED event
  channel.notifyEvent('open', { origin: message.origin, contract })
}
