/**
 * Route sealed frames through the channel's security transport.
 *
 * Handles Uint8Array payloads received via postMessage, routing them
 * through the appropriate channel's security transport.
 *
 * @module broker/routing/route-encrypted-message
 */

import type { ChannelHandle } from '../../types/channel'
import type { RoutingContext, RouteHandler } from './types'
import { createSecurityErrorEventData, logSecurityError } from '../../security/errors'

/**
 * Routes a wire frame to the appropriate channel's security transport.
 *
 * This function handles Uint8Array payloads received via postMessage:
 * 1. Resolves the target channel by the event's source window: the source
 *    window is the counterpart's identity, exactly as in the handshake
 * 2. Enforces the channel's pinned origin; mismatching payloads are dropped
 *    with an 'invalid' event before the transport sees them
 * 3. Hands the frame to the channel's security transport, which keys the
 *    session from a hello or opens a sealed frame and dispatches the
 *    transported action
 *
 * If no channel is registered for the source window or the channel has no
 * security transport, the frame is dropped with a log entry.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param router - Message router for handling opened actions
 * @param event - Message event containing the Uint8Array frame
 *
 * @example Routing wire frames
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
  const channel = source ? (registry.getByWindow(source as Window) as ChannelHandle | undefined) : undefined

  if (!channel) {
    logger.info(`${state.name} ignored a wire frame - no channel for the source window`)
    return
  }

  const pinnedOrigin = channel.getOrigin()
  if (pinnedOrigin !== null && pinnedOrigin !== '*' && pinnedOrigin !== event.origin) {
    channel.notifyEvent('invalid', { error: `Dropped a wire frame from unexpected origin '${event.origin}'.` })
    return
  }

  const securityTransport = channel.getSecurityTransport()

  if (!securityTransport) {
    logger.warn(`${state.name} received a wire frame but the ${channel.getName()} channel has no security transport`)
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
