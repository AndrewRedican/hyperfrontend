/**
 * Route encrypted messages through security transport.
 *
 * Handles Uint8Array payloads received via postMessage, routing them
 * through the appropriate channel's security transport for decryption.
 *
 * @module broker/routing/route-encrypted-message
 */

import type { ChannelHandle } from '../../types/channel'
import type { RoutingContext, RouteHandler } from './types'
import { createSecurityErrorEventData, logSecurityError } from '../../security/errors'

/**
 * Routes an encrypted message to the appropriate channel for decryption.
 *
 * This function handles Uint8Array payloads received via postMessage:
 * 1. Resolves the target channel by the event's source window: the source
 *    window is the counterpart's identity, exactly as in the handshake
 * 2. Enforces the channel's pinned origin; mismatching payloads are dropped
 *    with an 'invalid' event before any decryption runs
 * 3. Routes the encrypted payload through the channel's security transport
 * 4. The security transport decrypts and dispatches the transported action
 *
 * If no channel is registered for the source window or the channel has no
 * ready security transport, the message is dropped with a log entry.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param router - Message router for handling decrypted actions
 * @param event - Message event containing the encrypted Uint8Array payload
 *
 * @example Routing encrypted payloads
 * ```typescript
 * // In broker's onMessage handler:
 * if (event.data instanceof Uint8Array) {
 *   routeEncryptedMessage(routingContext, router, event)
 * }
 * ```
 */
export function routeEncryptedMessage(context: RoutingContext, router: Map<string, RouteHandler>, event: MessageEvent<Uint8Array>): void {
  const { state, registry, logger } = context
  const payload = event?.data

  if (!(payload instanceof Uint8Array)) {
    logger.warn('routeEncryptedMessage called with non-Uint8Array payload')
    return
  }

  const source = event.source
  const channel = source ? <ChannelHandle | undefined>registry.getByWindow(<Window>source) : undefined

  if (!channel) {
    logger.info(`${state.name} ignored encrypted message - no channel for the source window`)
    return
  }

  const pinnedOrigin = channel.getOrigin()
  if (pinnedOrigin !== null && pinnedOrigin !== '*' && pinnedOrigin !== event.origin) {
    channel.notifyEvent('invalid', { error: `Dropped encrypted message from unexpected origin '${event.origin}'.` })
    return
  }

  const securityTransport = channel.getSecurityTransport()

  if (!securityTransport) {
    logger.warn(`${state.name} received encrypted message but channel has no security transport`)
    return
  }

  if (!securityTransport.isReady()) {
    logger.warn(`${state.name} received encrypted message but security transport not ready`)
    return
  }

  try {
    securityTransport.receive(payload)
  } catch (error) {
    const errorData = createSecurityErrorEventData(error)
    logSecurityError(logger, channel.getName(), errorData)
    channel.notifyEvent('security-error', errorData)
  }
}
