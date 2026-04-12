import type { IAction, IActionWithContractAndSecurity } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { SecurityNegotiationRequest, SecurityProtocolVersion } from '../../types/security'
import type { RoutingContext } from './types'
import { getById } from '../../core/registry/get-by-id'
import { validateContract as validateContractFn } from '../../core/validation/contract'
import { negotiateProtocol, createSecurityResponse } from '../../security/negotiation/negotiate'
import { isActionWithContract } from '../../types/action'
import { addChannel } from '../channels/add'
import { applyPolicy } from '../security/apply-policy'

/**
 * Default supported security protocols for the responder.
 * Includes 'none' as fallback for backward compatibility.
 */
const DEFAULT_RESPONDER_SUPPORTED: readonly SecurityProtocolVersion[] = ['none']

/**
 * Handles REQUEST_CONNECTION action.
 * Creates or retrieves channel and initiates connection handshake.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the REQUEST_CONNECTION action
 *
 * @remarks
 * Side Effects:
 * - Creates new channel if not found in registry
 * - Tracks process ID for handshake completion
 * - Negotiates security protocol if security data present
 * - Sends ACCEPT_CONNECTION if validation passes
 * - Sends DENY_CONNECTION if contract or security policy fails
 *
 * @example Processing connection requests
 * Incoming action triggers:
 * 1. Channel lookup/creation
 * 2. Contract validation
 * 3. Security policy check
 * 4. Security protocol negotiation (if applicable)
 * 5. ACCEPT_CONNECTION response (or DENY if validation fails)
 */
export function handleRequest(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { state, registry, processManager, actions, logger } = context
  const action = message.data
  const senderId = <string>action.senderId

  if (!isActionWithContract(action)) {
    return
  }

  const processId = action.processId
  const contract = action.contract

  const securityRequest = <SecurityNegotiationRequest | undefined>(<IActionWithContractAndSecurity>action).security

  let channel = <ChannelHandle | undefined>getById(registry, senderId)
  if (!channel) {
    channel = addChannel(state, registry, processManager, actions, senderId, <Window>message.source, {})
  }

  processManager.create(channel)

  if (channel.isActive()) {
    if (senderId === channel.id) {
      const securityResponse = securityRequest
        ? createSecurityResponse(negotiateProtocol(securityRequest, DEFAULT_RESPONDER_SUPPORTED).negotiated)
        : undefined

      channel.sendAction({
        type: '[nexus] connection-request-accepted',
        processId,
        senderId: state.id,
        contract: state.contract,
        ...(securityResponse && { security: securityResponse }),
      })
    } else {
      logger.info(`${state.name} detected channel [${channel.getName()}] reloaded.`)
    }
    return
  }

  try {
    validateContractFn(contract)
  } catch {
    channel.sendAction({
      type: '[nexus] connection-request-denied',
      processId,
      senderId: state.id,
      error: 'Invalid contract.',
    })
    processManager.remove(processId)
    return
  }

  if (state.settings.securityPolicy) {
    const allowed = applyPolicy(state.settings.securityPolicy, message, logger)
    if (!allowed) {
      channel.sendAction({
        type: '[nexus] connection-request-denied',
        processId,
        senderId: state.id,
        error: 'Not accepted.',
      })
      processManager.remove(processId)
      return
    }
  }

  if (securityRequest) {
    channel.setPendingSecurityRequest(securityRequest)
  }

  if (!channel.isReadyToConnect()) {
    channel.scheduleActivation(senderId, message.origin, contract, processId)

    logger.info(`${state.name} scheduled activation for channel ${channel.getName()}`)
    return
  }

  let securityResponse = undefined
  if (securityRequest) {
    const result = negotiateProtocol(securityRequest, DEFAULT_RESPONDER_SUPPORTED)
    channel.setNegotiatedProtocol(result.negotiated)
    securityResponse = createSecurityResponse(result.negotiated)

    logger.info(`${state.name} negotiated security protocol: ${result.negotiated}`)
  }

  channel.activate(message.origin, contract)

  channel.sendAction({
    type: '[nexus] connection-request-accepted',
    processId,
    senderId: state.id,
    contract: state.contract,
    ...(securityResponse && { security: securityResponse }),
  })
}
