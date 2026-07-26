/**
 * Security transport attachment for the handshake tail.
 *
 * Builds the encrypted transport for a channel from the provider stored in
 * the broker's protocol registry and wires its callbacks: decrypted actions
 * re-enter the broker's routing exactly like plaintext ones, and transport
 * failures surface as 'security-error' channel events.
 *
 * @module broker/routing/attach-security-transport
 */

import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { SecurityErrorEventData } from '../../types/events'
import type { SecurityProtocolVersion, SecurityProvider } from '../../types/security'
import type { RoutingContext } from './types'
import { logSecurityError } from '../../security/errors'
import { createSecurityTransport } from '../../security/transport/factory'

/**
 * Attaches an encrypted security transport to a channel.
 *
 * Looks up the provider registered for the negotiated protocol, builds the
 * transport targeting the channel's counterpart window with the pinned
 * origin, and stores it on the channel. Decrypted inbound actions are routed
 * through the broker's handler map with the channel's window as the source,
 * so they dispatch into the channel exactly as plaintext actions do.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param channel - Channel the transport protects
 * @param protocol - Negotiated security protocol to attach
 * @param peerId - Broker id of the counterpart, stamped as each packet's target
 * @returns True when the transport was attached; false when no provider is
 * registered for the protocol (the channel is left without a transport)
 *
 * @example Attaching after the handshake negotiated v2
 * ```typescript
 * if (!attachSecurityTransport(context, channel, 'v2', peerId)) {
 *   logger.warn('no provider for the negotiated protocol')
 * }
 * ```
 */
export function attachSecurityTransport(
  context: RoutingContext,
  channel: ChannelHandle,
  protocol: SecurityProtocolVersion,
  peerId: string
): boolean {
  const { state, logger } = context

  const provider = <SecurityProvider | undefined>context.getProtocol(protocol)
  if (!provider) {
    return false
  }

  const transport = createSecurityTransport({
    protocol,
    provider,
    label: channel.getName(),
    target: channel.getTarget(),
    getOrigin: () => channel.getOrigin(),
    originId: state.id,
    targetId: peerId,
    onAction: (action) => {
      // why: Synthesizing the counterpart window as the source lets decrypted actions clear the same source-and-pinned-origin checks as plaintext ones.
      context.routeAction(<MessageEvent<IAction>>{
        data: <IAction>action,
        origin: channel.getOrigin() ?? '',
        source: channel.getTarget(),
      })
    },
    onError: (error) => {
      const errorData = <SecurityErrorEventData>error
      logSecurityError(logger, channel.getName(), errorData)
      channel.notifyEvent('security-error', errorData)
    },
  })

  channel.setSecurityTransport(transport)
  return true
}
