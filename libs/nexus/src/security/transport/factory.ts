/**
 * Security transport factory.
 *
 * Provides a unified factory for creating security transports
 * based on the negotiated protocol version.
 *
 * @module security/transport/factory
 */

import type { SecurityTransport, SecurityTransportConfig } from '../../types/security'
import { createNoneTransport } from './none-transport'
import { createSecureTransport } from './secure-transport'

/**
 * Creates a security transport based on the configured protocol.
 *
 * Routes to the appropriate transport implementation:
 * - `'none'`: Creates a passthrough transport (no encryption)
 * - `'v1'`/`'v2'`: Creates a secure transport with encryption
 *
 * @param config - Transport configuration
 * @param config.protocol - Security protocol version ('none', 'v1', or 'v2')
 * @param config.provider - Protocol provider (required for v1/v2)
 * @param config.sharedKey - Pre-shared key (required for v2)
 * @param config.refreshRate - Key rotation interval in minutes
 * @param config.target - Target window for postMessage
 * @param config.origin - Allowed origin for messages
 * @returns A security transport appropriate for the configured protocol
 * @throws {Error} If protocol is v1/v2 and provider is missing
 *
 * @example
 * ```typescript
 * // No security
 * const plainTransport = createSecurityTransport({
 *   protocol: 'none',
 *   target: iframe.contentWindow
 * })
 *
 * // V2 security with encryption
 * const secureTransport = createSecurityTransport({
 *   protocol: 'v2',
 *   provider: createProtocol(logger, 'shared-key', 60),
 *   target: iframe.contentWindow
 * })
 * ```
 */
export function createSecurityTransport(config: SecurityTransportConfig): SecurityTransport {
  const { protocol, provider, target, origin } = config

  if (protocol === 'none') {
    return createNoneTransport({ target, origin })
  }

  if (!provider) {
    throw new Error(
      `Security protocol '${protocol}' requires a protocol provider. ` +
        `Either register the provider with the broker or provide it in channel settings.`
    )
  }

  return createSecureTransport({
    protocol,
    provider,
    sharedKey: config.sharedKey,
    refreshRate: config.refreshRate,
    target,
    origin,
  })
}
