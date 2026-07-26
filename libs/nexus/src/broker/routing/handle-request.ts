import type { IAction, IActionWithContractAndSecurity } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { SecurityNegotiationRequest, SecurityProtocolVersion } from '../../types/security'
import type { RoutingContext } from './types'
import { validateContract as validateContractFn } from '../../core/validation/contract'
import { negotiateProtocol, createSecurityResponse } from '../../security/negotiation/negotiate'
import { isActionWithContract } from '../../types/action'
import { findMissingRequiredActions } from '../../utils/validation/find-missing-required-actions'
import { addChannel } from '../channels/add'
import { applyPolicy } from '../security/apply-policy'

/**
 * Default supported security protocols for the responder.
 * Includes 'none' as fallback for backward compatibility.
 */
const DEFAULT_RESPONDER_SUPPORTED: readonly SecurityProtocolVersion[] = ['none']

/**
 * Handles REQUEST_CONNECTION action.
 * Answers the connection request as the responder side of the handshake.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the REQUEST_CONNECTION action
 *
 * @remarks
 * Side Effects:
 * - Creates a new channel when the source window is unknown
 * - Drops requests whose origin does not match an already pinned origin
 * - Replays ACCEPT for duplicate requests from the connected counterpart
 * - Tears down and re-handshakes when the counterpart window reloaded
 * - Resolves simultaneous requests (glare) via a broker-id tie-break
 * - Denies invalid or incompatible contracts and policy-rejected requests
 * - Pins the origin, tracks the process, sends ACCEPT, and starts the
 *   responder deadline/retry timers when the local side is ready
 * - Schedules activation when the local side has not called connect() yet
 *
 * @example Processing a connection request
 * Incoming REQUEST triggers:
 * 1. Channel lookup by source window (or creation)
 * 2. Origin, contract, compatibility, and policy validation
 * 3. ACCEPT response with deadline/retry (or DENY on failure)
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

  let channel = <ChannelHandle | undefined>(message.source ? registry.getByWindow(<Window>message.source) : undefined)
  if (!channel) {
    channel = addChannel(state, registry, processManager, actions, senderId, <Window>message.source, {})
  }

  const pinnedOrigin = channel.getOrigin()
  if (pinnedOrigin !== null && pinnedOrigin !== '*' && pinnedOrigin !== message.origin) {
    channel.notifyEvent('invalid', { error: `Dropped connection request from unexpected origin '${message.origin}'.`, action })
    return
  }

  if (channel.isActive()) {
    if (channel.getPeerId() === senderId) {
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
      return
    }

    // why: A different sender id from the same window means the counterpart reloaded; tear down silently and fall through to a fresh handshake.
    logger.info(`${state.name} detected channel [${channel.getName()}] reloaded.`)
    channel.disconnect(false)
  }

  if (channel.getPendingProcessId()) {
    // why: Glare tie-break — the broker with the lower id yields and answers as responder; the higher id lets its own retried REQUEST win.
    if (state.id < senderId) {
      channel.abandonRequest()
    } else {
      return
    }
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
    return
  }

  const missingRequired = findMissingRequiredActions(state.contract, contract)
  if (missingRequired.length > 0) {
    channel.sendAction({
      type: '[nexus] connection-request-denied',
      processId,
      senderId: state.id,
      error: `Incompatible contract: missing required actions ${missingRequired.join(', ')}.`,
    })
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
      return
    }
  }

  if (securityRequest) {
    channel.setPendingSecurityRequest(securityRequest)
  }

  // why: The initiator confirms with OPEN carrying this processId, so it is tracked up front for handleOpen to resolve back to this channel.
  processManager.track(processId, channel)

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

  channel.beginResponse(senderId, message.origin, contract, processId, {
    type: '[nexus] connection-request-accepted',
    processId,
    senderId: state.id,
    contract: state.contract,
    ...(securityResponse && { security: securityResponse }),
  })
}
