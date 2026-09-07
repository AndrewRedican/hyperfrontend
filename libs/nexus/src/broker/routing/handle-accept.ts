import type { IAction, IActionBase } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { DenyReason } from '../../types/events'
import type { SecurityNegotiationResponse, SecurityConfirmation, SecurityProtocolVersion } from '../../types/security'
import type { RoutingContext } from './types'
import { validateContract } from '../../core/validation/contract'
import { requestsSecurity, requiresSecurity } from '../../security/settings'
import { isActionWithContract } from '../../types/action'
import { findMissingRequiredActions } from '../../utils/validation/find-missing-required-actions'
import { applyPolicy } from '../security/apply-policy'
import { resolveChannel } from './resolve-channel'

/** Why a pending connection attempt is aborted, surfaced on the deny event and the operator log. */
interface AbortDetails {
  /** Human-readable error delivered with the deny event. */
  error: string
  /** Machine-readable denial reason delivered with the deny event. */
  reason: DenyReason
  /** Operator-facing message logged when the connection aborts. */
  warning: string
}

/**
 * Aborts the pending connection attempt from the initiator's side.
 *
 * Stops the request retries, cancels the counterpart's pending response,
 * logs the operator-facing warning, and surfaces a deny event carrying the
 * error and the machine-readable reason, once per handshake process.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param channel - Channel whose connection attempt is aborted
 * @param processId - Process id of the aborted connection attempt
 * @param origin - Origin of the counterpart's ACCEPT event
 * @param details - The deny error, deny reason, and logged warning
 */
function abortConnection(context: RoutingContext, channel: ChannelHandle, processId: string, origin: string, details: AbortDetails): void {
  const { state, logger } = context

  channel.abandonRequest()
  channel.sendAction({
    type: '[nexus] connection-request-cancelled',
    processId,
    senderId: state.id,
  })

  logger.warn(details.warning)

  // why: A replayed ACCEPT that raced the CANCEL re-runs the gates, so the local event is fired once per handshake process.
  if (channel.markDenyNotified(processId)) {
    channel.notifyEvent('deny', { error: details.error, reason: details.reason, origin })
  }
}

/**
 * Aborts the pending connection because the channel is fail-closed and the
 * handshake could not deliver an encrypted transport.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param channel - Channel whose connection attempt is aborted
 * @param processId - Process id of the aborted connection attempt
 * @param origin - Origin of the counterpart's ACCEPT event
 */
function abortSecurityUnavailable(context: RoutingContext, channel: ChannelHandle, processId: string, origin: string): void {
  abortConnection(context, channel, processId, origin, {
    error: 'Security is required for this channel but the counterpart cannot provide an encrypted protocol.',
    reason: 'security-unavailable',
    warning: `${context.state.name} aborted the ${channel.getName()} connection: security is required but unavailable.`,
  })
}

/**
 * Settles the security outcome the counterpart's ACCEPT proposes.
 *
 * The outcome is the protocol this channel asked for or plaintext: a
 * counterpart selecting any other protocol is treated as offering none,
 * because the request never advertised it. A selected protocol is attached
 * here, before OPEN leaves, so a provider that cannot serve the session
 * degrades the confirmation itself.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param channel - Channel whose connection is being accepted
 * @param response - The counterpart's security negotiation response
 * @param senderId - Broker id of the counterpart
 * @returns The settled protocol, 'none' when no encrypted transport is attached
 */
function settleSecurity(
  context: RoutingContext,
  channel: ChannelHandle,
  response: SecurityNegotiationResponse,
  senderId: string
): SecurityProtocolVersion {
  const { state, logger } = context
  const settings = channel.getSecuritySettings()
  const requested = requestsSecurity(settings) ? settings.protocol : 'none'

  let negotiated = response.negotiated

  if (negotiated !== 'none' && negotiated !== requested) {
    // why: The request advertised one protocol; an answer naming another is a forgery or a fault, and either way not a session this channel asked for.
    logger.warn(
      `${state.name} ignored the '${negotiated}' protocol the counterpart selected for channel ${channel.getName()}: the channel asked for '${requested}'.`
    )
    negotiated = 'none'
  }

  if (negotiated !== 'none' && !channel.attachSecurityTransport(negotiated, senderId, 'initiator')) {
    // why: The counterpart agreed to encrypt but no local provider can serve the protocol, so the outcome degrades to plaintext.
    logger.warn(`${state.name} has no working provider for the negotiated '${negotiated}' protocol.`)
    negotiated = 'none'
  }

  channel.setNegotiatedProtocol(negotiated)
  logger.info(`${state.name} accepted security protocol: ${negotiated}`)
  return negotiated
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
 * - Drops ACCEPTs that do not answer the request this side has pending,
 *   with an 'invalid' event, so a stray or forged acceptance cannot open
 *   a connection the channel did not ask for
 * - Cancels and fires 'deny' with reason 'invalid-contract',
 *   'missing-required-actions', 'policy-rejected', or
 *   'incompatible-contract' when the corresponding gate rejects the
 *   responder's contract or the acceptance itself, so the aborting side's
 *   consumer is never left waiting on a handshake it gave up on
 * - Fires each local 'deny' event once per handshake process, so a replayed
 *   ACCEPT that raced the CANCEL does not notify local subscribers again
 * - Treats a negotiated protocol other than the one the channel asked for
 *   as a plaintext outcome
 * - Attaches the security transport for the negotiated protocol before OPEN
 *   leaves, so queued product traffic leaves sealed; the transport starts
 *   its hello exchange with the OPEN
 * - Aborts with reason 'security-unavailable' when the channel is
 *   fail-closed and no encrypted transport can be established; falls back
 *   to plaintext with a warning otherwise
 * - Pins the origin, activates the channel (own contract stays authoritative),
 *   sends OPEN confirming the security outcome, flushes the queue, and fires
 *   the 'open' event; 'security-ready' follows once the counterpart's first
 *   sealed frame authenticates
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
  const senderId = action.senderId as string

  const securityResponse = (action as IActionBase).security as SecurityNegotiationResponse | undefined

  // why: The process is removed at handshake completion, so a duplicate ACCEPT (lost OPEN) resolves by source window with the origin pin enforced.
  const channel =
    (processManager.get(processId) as ChannelHandle | undefined) ?? (resolveChannel(registry, message) as ChannelHandle | undefined)

  if (!channel) {
    return
  }

  if (channel.isActive()) {
    if (channel.getPeerId() === senderId) {
      // why: The replayed OPEN must repeat the original security confirmation, or the responder recovering from a lost OPEN would complete a plaintext open.
      const negotiated = channel.getNegotiatedProtocol()
      channel.sendAction({
        type: '[nexus] connection-opened',
        processId,
        senderId: state.id,
        ...(negotiated !== null && { security: { active: channel.getSecurityTransport() !== null, protocol: negotiated } }),
      })
    }
    return
  }

  const pinnedOrigin = channel.getOrigin()
  if (pinnedOrigin !== null && pinnedOrigin !== '*' && pinnedOrigin !== message.origin) {
    channel.notifyEvent('invalid', { error: `Dropped connection acceptance from unexpected origin '${message.origin}'.`, action })
    return
  }

  if (channel.getPendingProcessId() !== processId) {
    // why: Only the request this side has in flight can be accepted; anything else is stale, or an acceptance forged for a channel that never asked.
    channel.notifyEvent('invalid', { error: `Dropped connection acceptance for unknown process '${processId}'.`, action })
    return
  }

  try {
    validateContract(contract)
  } catch (error) {
    abortConnection(context, channel, processId, message.origin, {
      error: `Invalid contract: ${(error as Error).message}.`,
      reason: 'invalid-contract',
      warning: `${state.name} aborted the ${channel.getName()} connection: the counterpart accepted with an invalid contract.`,
    })
    return
  }

  if (state.settings.securityPolicy && !applyPolicy(state.settings.securityPolicy, message, logger)) {
    abortConnection(context, channel, processId, message.origin, {
      error: `Connection acceptance from '${message.origin}' was rejected by the channel security policy.`,
      reason: 'policy-rejected',
      warning: `${state.name} aborted the ${channel.getName()} connection: the channel security policy rejected the acceptance.`,
    })
    return
  }

  const missingRequired = findMissingRequiredActions(state.contract, contract)
  if (missingRequired.length > 0) {
    abortConnection(context, channel, processId, message.origin, {
      error: `Incompatible contract: missing required actions ${missingRequired.join(', ')}.`,
      reason: 'missing-required-actions',
      warning: `${state.name} aborted the ${channel.getName()} connection: missing required actions ${missingRequired.join(', ')}.`,
    })
    return
  }

  const contractCompat = channel.getContractCompat()
  if (contractCompat) {
    const compatibility = contractCompat(state.contract, contract)
    if (compatibility.compatible === false) {
      abortConnection(context, channel, processId, message.origin, {
        error: compatibility.reason,
        reason: 'incompatible-contract',
        warning: `${state.name} aborted the ${channel.getName()} connection: ${compatibility.reason}`,
      })
      return
    }
  }

  const securitySettings = channel.getSecuritySettings()

  let securityConfirmation: SecurityConfirmation | undefined = undefined
  if (securityResponse) {
    const negotiated = settleSecurity(context, channel, securityResponse, senderId)

    if (negotiated === 'none') {
      if (requiresSecurity(securitySettings)) {
        abortSecurityUnavailable(context, channel, processId, message.origin)
        return
      }
      if (requestsSecurity(securitySettings)) {
        logger.warn(
          `${state.name} requested security for channel ${channel.getName()} but negotiation ended in plaintext; continuing without encryption.`
        )
      }
    }

    securityConfirmation = {
      active: negotiated !== 'none',
      protocol: negotiated,
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

  channel.completeConnection(message.origin, contract, senderId, {
    type: '[nexus] connection-opened',
    processId,
    senderId: state.id,
    ...(securityConfirmation && { security: securityConfirmation }),
  })

  processManager.remove(processId)

  channel.notifyEvent('open', { origin: message.origin, contract })
}
