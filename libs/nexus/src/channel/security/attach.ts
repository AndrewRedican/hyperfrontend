import type { IAction } from '../../types/action'
import type { SecurityProtocolVersion, SecuritySessionRole } from '../../types/security'
import type { ChannelInternals } from '../types'
import { logSecurityError } from '../../security/errors'
import { createSecureTransport } from '../../security/transport/secure-transport'
import { dropSecurityTransport } from './drop'
import { failSecurity } from './fail'

/**
 * Attaches an encrypted security transport to a channel.
 *
 * Looks up the provider the broker registered for the negotiated protocol,
 * builds the transport targeting the channel's counterpart window with the
 * pinned origin, and stores it on the channel in place of any earlier one.
 * The transport is not started: the handshake step that sends the next
 * plaintext frame starts it, so the hello follows that frame on the wire.
 *
 * Opened inbound actions are routed through the broker's handler map with
 * the channel's window as the source, so they dispatch into the channel
 * exactly as plaintext actions do. Transport failures surface as
 * `security-error` events; the counterpart's confirmation fires
 * `security-ready`; a session that cannot be confirmed terminates the
 * connection.
 *
 * @param channel - Channel internals with state and dependencies
 * @param protocol - Negotiated security protocol to attach
 * @param peerId - Broker id of the counterpart, stamped as each packet's target
 * @param role - This side's handshake role
 * @returns True when the transport was attached; false when no provider is
 * registered for the protocol or the provider refused the session (the
 * channel is left without a transport)
 *
 * @example Attaching after the handshake negotiated v4
 * ```typescript
 * if (!attachSecurityTransport(internals, 'v4', peerId, 'initiator')) {
 *   logger.warn('no provider for the negotiated protocol')
 * }
 * ```
 */
export function attachSecurityTransport(
  channel: ChannelInternals,
  protocol: SecurityProtocolVersion,
  peerId: string,
  role: SecuritySessionRole
): boolean {
  const security = channel.security
  const provider = security?.getProvider(protocol)
  if (!security || !provider) {
    return false
  }

  dropSecurityTransport(channel)

  const state = channel.getState()
  const logger = state.logger

  try {
    const transport = createSecureTransport({
      protocol,
      provider,
      label: state.name,
      target: state.target,
      getOrigin: () => channel.getState().origin,
      originId: security.localId,
      targetId: peerId,
      role,
      helloRetryMs: state.requestRetryMs,
      confirmTimeoutMs: state.connectTimeoutMs,
      onAction: (action) => {
        // why: Synthesizing the counterpart window as the source lets opened actions clear the same source-and-pinned-origin checks as plaintext ones.
        security.dispatch({
          data: action as IAction,
          origin: channel.getState().origin ?? '',
          source: state.target,
        } as MessageEvent<IAction>)
      },
      onError: (error) => {
        if (logger) {
          logSecurityError(logger, state.name, error)
        }
        channel.notifyEvent('security-error', error)
      },
      onConfirmed: () => {
        channel.notifyEvent('security-ready', { protocol })
      },
      onFailed: (error) => {
        failSecurity(channel, error)
      },
    })
    channel.updateState({ securityTransport: transport })
    return true
  } catch (error) {
    logger?.warn(`Cannot attach the '${protocol}' security transport to channel ${state.name}: ${(error as Error).message}`)
    return false
  }
}
