/**
 * Security transport factory.
 *
 * Provides a unified factory for creating security transports
 * based on the negotiated protocol version.
 *
 * @module security/transport/factory
 */

import type { SecurityTransport, SecurityTransportConfig } from '../../types/security'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_REQUEST_RETRY_MS } from '../../constants/defaults'
import { createNoneTransport } from './none-transport'
import { createSecureTransport } from './secure-transport'

/**
 * Creates a security transport based on the configured protocol.
 *
 * Routes to the appropriate transport implementation:
 * - `'none'`: Creates a passthrough transport (no encryption)
 * - Any other protocol: Creates a secure transport driving the provider's
 *   pipeline
 *
 * @param config - Transport configuration
 * @param config.protocol - Security protocol version (e.g. 'none', 'v3', or 'v4')
 * @param config.provider - Security implementation (required for protocols other than 'none')
 * @param config.label - Human-readable label surfaced in protocol diagnostics
 * @param config.target - Counterpart window that receives outbound traffic
 * @param config.getOrigin - Returns the origin currently pinned to the channel, or null before pinning
 * @param config.originId - UUID identifying the local endpoint
 * @param config.targetId - UUID identifying the counterpart endpoint
 * @param config.role - This endpoint's handshake role
 * @param config.helloRetryMs - Interval between hello retries (defaults to the request retry interval)
 * @param config.confirmTimeoutMs - Confirmation deadline (defaults to the connect timeout)
 * @param config.onAction - Receives each action delivered by the transport
 * @param config.onError - Optional handler for security failures
 * @param config.onConfirmed - Optional handler invoked once the counterpart confirms the session
 * @param config.onFailed - Optional handler invoked when the session can no longer be confirmed
 * @returns A security transport appropriate for the configured protocol
 * @throws {Error} If the protocol requires a provider and none is given
 *
 * @example Creating security transports
 * ```typescript
 * import { logger } from '@hyperfrontend/logging'
 * import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
 * import { createProtocol } from '@hyperfrontend/network-protocol/browser/v4'
 *
 * const transport = createSecurityTransport({
 *   protocol: 'v4',
 *   provider: { createChannel, protocolProvider: createProtocol(logger, 'shared-key') },
 *   label: 'checkout-feature',
 *   target: iframe.contentWindow,
 *   getOrigin: () => 'https://feature.example.com',
 *   originId: hostId,
 *   targetId: featureId,
 *   role: 'initiator',
 *   onAction: (action) => handleAction(action),
 * })
 * ```
 */
export function createSecurityTransport(config: SecurityTransportConfig): SecurityTransport {
  const { protocol, provider, label, target, getOrigin, originId, targetId, role, onAction, onError, onConfirmed, onFailed } = config

  if (protocol === 'none') {
    return createNoneTransport({ target, getOrigin, onAction })
  }

  if (!provider) {
    throw createError(
      `Security protocol '${protocol}' requires a protocol provider. ` +
        `Either register the provider with the broker or provide it in channel settings.`
    )
  }

  return createSecureTransport({
    protocol,
    provider,
    label,
    target,
    getOrigin,
    originId,
    targetId,
    role,
    helloRetryMs: config.helloRetryMs ?? DEFAULT_REQUEST_RETRY_MS,
    confirmTimeoutMs: config.confirmTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
    onAction,
    onError,
    onConfirmed,
    onFailed,
  })
}
