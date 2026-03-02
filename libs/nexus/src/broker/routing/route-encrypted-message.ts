/**
 * Route encrypted messages through security transport.
 *
 * Handles Uint8Array payloads received via postMessage, routing them
 * through the appropriate channel's security transport for decryption.
 *
 * @module broker/routing/route-encrypted-message
 */

import type { Registry } from '../../core/registry/factory'
import type { ChannelHandle } from '../../types/channel'
import type { RoutingContext, RouteHandler } from './types'
import { getAll } from '../../core/registry/get-all'
import { createSecurityErrorEventData, logSecurityError } from '../../security/errors'

/**
 * Extended security transport interface with handleReceive method.
 *
 * @internal
 */
interface SecurityTransportWithReceive {
  handleReceive: (packet: Uint8Array) => void
  isReady: () => boolean
  getProtocol: () => string
}

/**
 * Routes an encrypted message to the appropriate channel for decryption.
 *
 * This function handles Uint8Array payloads received via postMessage:
 * 1. Identifies the target channel based on message origin
 * 2. Routes the encrypted payload through the channel's security transport
 * 3. The security transport decrypts and invokes the registered receive handler
 *
 * If no matching channel is found or the channel has no security transport,
 * the message is silently dropped (with optional debug logging).
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param router - Message router for handling decrypted actions
 * @param event - Message event containing the encrypted Uint8Array payload
 *
 * @example
 * ```typescript
 * // In broker's onMessage handler:
 * if (event.data instanceof Uint8Array) {
 *   routeEncryptedMessage(routingContext, router, event)
 * }
 * ```
 */
export function routeEncryptedMessage(context: RoutingContext, router: Map<string, RouteHandler>, event: MessageEvent<Uint8Array>): void {
  const { state, registry, logger } = context
  const origin = event?.origin
  const payload = event?.data

  if (!(payload instanceof Uint8Array)) {
    logger.warn('routeEncryptedMessage called with non-Uint8Array payload')
    return
  }

  const channel = findChannelByOrigin(registry, origin)

  if (!channel) {
    logger.info(`${state.name} ignored encrypted message - no channel for origin ${origin}`)
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

  const transportWithReceive = <SecurityTransportWithReceive>(<unknown>securityTransport)

  if (typeof transportWithReceive.handleReceive !== 'function') {
    logger.error('Security transport missing handleReceive method')
    return
  }

  try {
    transportWithReceive.handleReceive(payload)
  } catch (error) {
    const errorData = createSecurityErrorEventData(error)
    logSecurityError(logger, channel.getName(), errorData)
    channel.notifyEvent('security-error', errorData)
  }
}

/**
 * Finds a channel by origin in the registry.
 *
 * Since encrypted messages don't contain senderId, we must match
 * by origin. This works because each channel has a unique target window
 * and thus a unique origin.
 *
 * @param registry - Channel registry to search
 * @param origin - Origin of the message sender
 * @returns The matching channel handle, or undefined if not found
 *
 * @internal
 */
function findChannelByOrigin(registry: Registry, origin: string): ChannelHandle | undefined {
  const allChannels = getAll(registry)

  for (const channel of allChannels) {
    const channelHandle = <ChannelHandle>channel

    if (!channelHandle.isActive || typeof channelHandle.isActive !== 'function') {
      continue
    }

    if (!channelHandle.isActive()) {
      continue
    }

    const channelJSON = channelHandle.toJSON()
    if (channelJSON.origin === origin) {
      return channelHandle
    }
  }

  return undefined
}
