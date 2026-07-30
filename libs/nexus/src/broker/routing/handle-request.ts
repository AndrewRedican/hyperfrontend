import type { IAction, IActionWithContractAndSecurity } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { DenyReason } from '../../types/events'
import type { SecurityNegotiationRequest, SecurityNegotiationResponse } from '../../types/security'
import type { RoutingContext } from './types'
import { validateContract as validateContractFn } from '../../core/validation/contract'
import { negotiateProtocol, createSecurityResponse } from '../../security/negotiation/negotiate'
import { requestsSecurity, requiresSecurity } from '../../security/settings'
import { isActionWithContract } from '../../types/action'
import { findMissingRequiredActions } from '../../utils/validation/find-missing-required-actions'
import { addChannel } from '../channels/add'
import { applyPolicy } from '../security/apply-policy'

/** Why a connection request is refused, as told to the counterpart and to this side's consumer. */
interface DenyDetails {
  /** Human-readable error surfaced on the local deny event, and on the DENY frame unless `opaqueError` replaces it. */
  error: string
  /** Machine-readable denial reason surfaced on the local deny event, and on the DENY frame unless `opaqueError` replaces it. */
  reason: DenyReason
  /** Error sent to the counterpart in place of `error`, withholding the reason, when the requester must not learn how it was judged. */
  opaqueError?: string
}

/**
 * Refuses a connection request as the responder side of the handshake.
 *
 * Sends the DENY frame to the counterpart and fires the same denial locally
 * as a 'deny' event, once per handshake process.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param channel - Channel the refused request arrived on
 * @param processId - Process id of the refused handshake
 * @param origin - Origin of the counterpart that made the request
 * @param details - The local deny payload and the counterpart-facing error
 */
function denyRequest(context: RoutingContext, channel: ChannelHandle, processId: string, origin: string, details: DenyDetails): void {
  channel.sendAction({
    type: '[nexus] connection-request-denied',
    processId,
    senderId: context.state.id,
    error: details.opaqueError ?? details.error,
    ...(details.opaqueError === undefined && { reason: details.reason }),
  })

  // why: The DENY frame informs only the counterpart; the local deny event tells this side's consumer the pair cannot open.
  // why: The counterpart retries REQUEST with the same process id, so the local event is fired once per handshake process.
  if (channel.markDenyNotified(processId)) {
    channel.notifyEvent('deny', { error: details.error, reason: details.reason, origin })
  }
}

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
 * - Ends the session and re-handshakes on the same channel when the request
 *   comes from a different instance in the connected window (a reload or
 *   in-frame navigation), firing 'close' with `reason: 'peer-reload'`
 * - Resolves simultaneous requests (glare) via a broker-id tie-break
 * - Denies with reason 'invalid-contract' when the counterpart's contract
 *   fails structural validation, 'missing-required-actions' when it omits an
 *   action this side requires, 'policy-rejected' when the broker's security
 *   policy refuses the request, 'incompatible-contract' when the channel's
 *   contract-compatibility rule rejects the pair, and 'security-unavailable'
 *   when the channel is fail-closed and the negotiation outcome is plaintext
 * - Fires every denial locally as a 'deny' event carrying its reason, so the
 *   denying side's consumer is never left waiting on a channel it refused
 * - Withholds the reason from the DENY frame for a policy rejection: the
 *   refused requester is told only that it was not accepted
 * - Negotiates the security protocol against the broker's protocol registry
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
    // why: Named from the requester's origin, not its broker id — the id identifies one incarnation of the counterpart, while the channel outlives every incarnation the window loads.
    channel = addChannel(state, registry, processManager, actions, `inbound-${message.origin}`, <Window>message.source, {})
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

    // why: A different sender id from the same window means the window now hosts a different instance; end the session it belonged to and fall through to a fresh handshake on the same channel.
    logger.info(`${state.name} detected channel [${channel.getName()}] reloaded.`)
    channel.endStaleSession()
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
  } catch (error) {
    denyRequest(context, channel, processId, message.origin, {
      // why: The validator's verdict is about the requester's own contract, so naming the offending part discloses nothing and is the only actionable detail either side has.
      error: `Invalid contract: ${(<Error>error).message}.`,
      reason: 'invalid-contract',
    })
    return
  }

  const missingRequired = findMissingRequiredActions(state.contract, contract)
  if (missingRequired.length > 0) {
    denyRequest(context, channel, processId, message.origin, {
      error: `Incompatible contract: missing required actions ${missingRequired.join(', ')}.`,
      reason: 'missing-required-actions',
    })
    return
  }

  const contractCompat = channel.getContractCompat()
  if (contractCompat) {
    const compatibility = contractCompat(state.contract, contract)
    if (compatibility.compatible === false) {
      denyRequest(context, channel, processId, message.origin, { error: compatibility.reason, reason: 'incompatible-contract' })
      return
    }
  }

  if (state.settings.securityPolicy && !applyPolicy(state.settings.securityPolicy, message, logger)) {
    denyRequest(context, channel, processId, message.origin, {
      error: `Connection request from '${message.origin}' was rejected by the channel security policy.`,
      reason: 'policy-rejected',
      // why: Naming the gate would tell a requester the policy just refused how this side judges connections; it learns only that it was not accepted.
      opaqueError: 'Not accepted.',
    })
    return
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
      denyRequest(context, channel, processId, message.origin, {
        error: 'Security is required for this channel but the counterpart cannot negotiate an encrypted protocol.',
        reason: 'security-unavailable',
      })
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
