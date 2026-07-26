import type { IAction, IActionWithContractAndSecurity } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { SecurityNegotiationRequest, SecurityNegotiationResponse } from '../../types/security'
import type { RoutingContext } from './types'
import { validateContract as validateContractFn } from '../../core/validation/contract'
import { negotiateProtocol, createSecurityResponse } from '../../security/negotiation/negotiate'
import { requestsSecurity, requiresSecurity } from '../../security/settings'
import { isActionWithContract } from '../../types/action'
import { findMissingRequiredActions } from '../../utils/validation/find-missing-required-actions'
import { addChannel } from '../channels/add'
import { applyPolicy } from '../security/apply-policy'

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
 * - Denies with reason 'incompatible-contract' when the channel's
 *   contract-compatibility rule rejects the counterpart's contract, firing
 *   the same denial locally as a 'deny' event
 * - Negotiates the security protocol against the broker's protocol registry
 * - Denies with reason 'security-unavailable' when the channel is
 *   fail-closed and the negotiation outcome is plaintext, firing the same
 *   denial locally as a 'deny' event
 * - Fires each local 'deny' event once per handshake process: a retried
 *   REQUEST re-using the process id is answered with another DENY frame
 *   but does not notify local subscribers again
 * - Pins the origin, tracks the process, sends ACCEPT, and starts the
 *   responder deadline/retry timers when the local side is ready
 * - Schedules activation (carrying the negotiated security response) when
 *   the local side has not called connect() yet
 *
 * @example Processing a connection request
 * Incoming REQUEST triggers:
 * 1. Channel lookup by source window (or creation)
 * 2. Origin, contract, compatibility, policy, and security validation
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
        ? createSecurityResponse(negotiateProtocol(securityRequest, context.getSupportedProtocols()).negotiated)
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

  const contractCompat = channel.getContractCompat()
  if (contractCompat) {
    const compatibility = contractCompat(state.contract, contract)
    if (compatibility.compatible === false) {
      channel.sendAction({
        type: '[nexus] connection-request-denied',
        processId,
        senderId: state.id,
        error: compatibility.reason,
        reason: 'incompatible-contract',
      })
      // why: The DENY frame informs only the counterpart; the local deny event tells this side's consumer the pair cannot open.
      // why: The counterpart retries REQUEST with the same process id, so the local event is fired once per handshake process.
      if (channel.markDenyNotified(processId)) {
        channel.notifyEvent('deny', { error: compatibility.reason, reason: 'incompatible-contract', origin: message.origin })
      }
      return
    }
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

  let securityResponse: SecurityNegotiationResponse | undefined = undefined
  if (securityRequest) {
    channel.setPendingSecurityRequest(securityRequest)

    const result = negotiateProtocol(securityRequest, context.getSupportedProtocols())
    channel.setNegotiatedProtocol(result.negotiated)
    securityResponse = createSecurityResponse(result.negotiated)

    logger.info(`${state.name} negotiated security protocol: ${result.negotiated}`)
  }

  if ((securityResponse?.negotiated ?? 'none') === 'none') {
    const securitySettings = channel.getSecuritySettings()
    if (requiresSecurity(securitySettings)) {
      const error = 'Security is required for this channel but the counterpart cannot negotiate an encrypted protocol.'
      channel.sendAction({
        type: '[nexus] connection-request-denied',
        processId,
        senderId: state.id,
        error,
        reason: 'security-unavailable',
      })
      // why: The DENY frame informs only the counterpart; the local deny event tells this side's consumer the pair cannot open.
      // why: The counterpart retries REQUEST with the same process id, so the local event is fired once per handshake process.
      if (channel.markDenyNotified(processId)) {
        channel.notifyEvent('deny', { error, reason: 'security-unavailable', origin: message.origin })
      }
      return
    }
    if (requestsSecurity(securitySettings)) {
      logger.warn(
        `${state.name} requested security for channel ${channel.getName()} but negotiation ended in plaintext; continuing without encryption.`
      )
    }
  }

  // why: The initiator confirms with OPEN carrying this processId, so it is tracked up front for handleOpen to resolve back to this channel.
  processManager.track(processId, channel)

  if (!channel.isReadyToConnect()) {
    channel.scheduleActivation(senderId, message.origin, contract, processId, securityResponse)

    logger.info(`${state.name} scheduled activation for channel ${channel.getName()}`)
    return
  }

  channel.beginResponse(senderId, message.origin, contract, processId, {
    type: '[nexus] connection-request-accepted',
    processId,
    senderId: state.id,
    contract: state.contract,
    ...(securityResponse && { security: securityResponse }),
  })
}
