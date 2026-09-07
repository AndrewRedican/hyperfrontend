import type { ScheduledActivation } from '../../types/channel'
import type { SecurityNegotiationResponse } from '../../types/security'
import type { ChannelInternals } from '../types'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createSecurityRequest, createSecurityResponse } from '../../security/negotiation/negotiate'
import { requestsSecurity, requiresSecurity } from '../../security/settings'
import { attachSecurityTransport } from '../security/attach'
import { beginResponse } from './begin-response'
import { expireHandshake, startHandshakeTimers } from './handshake-timers'

/**
 * Refuses a scheduled request because the channel is fail-closed and the
 * negotiated provider can no longer serve the session.
 *
 * Sends DENY to the counterpart, forgets the scheduled activation and its
 * tracked process, and surfaces a deny event with reason
 * 'security-unavailable'.
 *
 * @param channel - Channel internals with state and dependencies
 * @param activation - The scheduled activation being refused
 */
function refuseScheduledActivation(channel: ChannelInternals, activation: ScheduledActivation): void {
  const [, origin, , processId] = activation
  const error = 'Security is required for this channel but no provider can serve the negotiated protocol.'

  // why: The counterpart's deny event names the reason exactly as every other security denial does.
  channel.sendAction({ ...channel.actions.denyConnection(processId, error), reason: 'security-unavailable' })
  channel.removeProcess(processId)
  channel.updateState({ scheduledActivation: null, negotiatedProtocol: null, pendingSecurityRequest: null })
  channel.notifyEvent('deny', { error, reason: 'security-unavailable', origin })
}

/**
 * Answers a request that arrived before connect() was called.
 *
 * The security transport for the negotiated protocol is attached here, at
 * the moment ACCEPT is composed, so a request nobody answers costs no
 * session material. A provider that cannot serve the session degrades the
 * answer to plaintext, or refuses it when the channel is fail-closed.
 *
 * @param channel - Channel internals with state and dependencies
 * @param activation - The scheduled activation to answer
 */
function answerScheduledActivation(channel: ChannelInternals, activation: ScheduledActivation): void {
  const [senderId, , , processId, security] = activation
  let response: SecurityNegotiationResponse | undefined = security

  if (security && security.negotiated !== 'none' && !attachSecurityTransport(channel, security.negotiated, senderId, 'responder')) {
    const state = channel.getState()
    state.logger?.warn(`No working provider for the '${security.negotiated}' protocol negotiated on channel ${state.name}.`)
    if (requiresSecurity(state.security)) {
      refuseScheduledActivation(channel, activation)
      return
    }
    if (requestsSecurity(state.security)) {
      state.logger?.warn(
        `Channel ${state.name} requested security but the negotiated provider is unavailable; continuing without encryption.`
      )
    }
    response = createSecurityResponse('none')
    channel.updateState({ negotiatedProtocol: 'none' })
  }

  beginResponse(channel, activation, channel.actions.acceptConnection(processId, response))
}

/**
 * Initiates the connection handshake for a channel.
 *
 * - If the channel is already open or mid-handshake, does nothing
 * - If a REQUEST arrived before connect() (scheduled activation), answers it
 *   as the responder: attaches the negotiated security transport, sends
 *   ACCEPT carrying the negotiated security response, and waits for OPEN
 * - Otherwise acts as the initiator: sends REQUEST (advertising the security
 *   protocol selected by the channel settings, with plaintext as fallback),
 *   re-sends it every `requestRetryMs`, and fires 'connect-timeout' if no
 *   ACCEPT arrives within `connectTimeoutMs`
 *
 * The channel becomes active only when the wire handshake completes; after
 * a 'connect-timeout' the channel stays inactive with queued messages retained, and
 * connect() may be called again.
 *
 * @param channel - Channel internals with state and dependencies
 *
 * @example Initiating a connection
 * ```typescript
 * connect(channel) // Sends REQUEST_CONNECTION or answers a pending request
 * ```
 */
export function connect(channel: ChannelInternals): void {
  const state = channel.getState()

  if (state.active || state.pendingProcessId || state.pendingAccept) {
    return
  }

  if (!state.readyToConnect) {
    channel.updateState({ readyToConnect: true })
  }

  if (!state.connectTimestamp) {
    channel.updateState({ connectTimestamp: dateNow() })
  }

  if (state.scheduledActivation) {
    answerScheduledActivation(channel, state.scheduledActivation)
    return
  }

  const processId = channel.createProcess()
  channel.updateState({ pendingProcessId: processId })

  // why: The channel's security settings drive the advertisement; 'none' trails as the compatibility fallback for counterparts without the protocol.
  const security = state.security
  const requestAction = channel.actions.requestConnection(
    processId,
    requestsSecurity(security) ? createSecurityRequest([security.protocol, 'none']) : undefined
  )

  // why: Timers start before the send so a synchronously delivered ACCEPT finds them registered and clears them.
  startHandshakeTimers(channel, requestAction, () => expireHandshake(channel, processId))

  channel.sendAction(requestAction)
}
