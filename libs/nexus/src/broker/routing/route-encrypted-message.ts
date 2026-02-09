/**
 * Route encrypted messages through security transport.
 *
 * Handles Uint8Array payloads received via postMessage, routing them
 * through the appropriate channel's security transport for decryption.
 *
 * @module broker/routing/route-encrypted-message
 */

import type { BrokerState } from '../types'
import type { Registry } from '../../core/registry/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { ActionCreators } from '../../core/actions/factory'
import type { RouteHandler } from './create-router'
import type { ChannelHandle } from '../../types/channel'
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
 * @param state - Current broker state
 * @param registry - Channel registry for accessing channels
 * @param processManager - Process manager (unused, for signature compatibility)
 * @param actions - Action creators (unused, for signature compatibility)
 * @param router - Message router for handling decrypted actions
 * @param event - Message event containing the encrypted Uint8Array payload
 *
 * @example
 * ```typescript
 * // In broker's onMessage handler:
 * if (event.data instanceof Uint8Array) {
 *   routeEncryptedMessage(state, registry, processManager, actions, router, event)
 * }
 * ```
 */
export function routeEncryptedMessage(
  state: BrokerState,
  registry: Registry,
  processManager: ProcessManager,
  actions: ActionCreators,
  router: Map<string, RouteHandler>,
  event: MessageEvent<Uint8Array>
): void {
  const origin = event?.origin
  const payload = event?.data

  if (!(payload instanceof Uint8Array)) {
    if (state.settings.debug) {
      console.warn('[nexus] routeEncryptedMessage called with non-Uint8Array payload')
    }
    return
  }

  const channel = findChannelByOrigin(registry, origin)

  if (!channel) {
    if (state.settings.debug) {
      console.info(`[nexus] ${state.name} ignored encrypted message - no channel for origin ${origin}`)
    }
    return
  }

  const securityTransport = channel.getSecurityTransport()

  if (!securityTransport) {
    if (state.settings.debug) {
      console.warn(`[nexus] ${state.name} received encrypted message but channel has no security transport`)
    }
    return
  }

  if (!securityTransport.isReady()) {
    if (state.settings.debug) {
      console.warn(`[nexus] ${state.name} received encrypted message but security transport not ready`)
    }
    return
  }

  const transportWithReceive = <SecurityTransportWithReceive>(<unknown>securityTransport)

  if (typeof transportWithReceive.handleReceive !== 'function') {
    if (state.settings.debug) {
      console.error(`[nexus] Security transport missing handleReceive method`)
    }
    return
  }

  try {
    transportWithReceive.handleReceive(payload)
  } catch (error) {
    const errorData = createSecurityErrorEventData(error)
    logSecurityError(channel.getName(), errorData, state.settings.debug ?? false)
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
