import type { BrokerHandle, SecurityProtocolProvider, SecurityProvider } from '@hyperfrontend/nexus'
import type { SecurityProtocol } from './types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
import { createProtocol as createV3Protocol } from '@hyperfrontend/network-protocol/browser/v3'
import { createProtocol as createV4Protocol, isValidSharedKey, MIN_SHARED_KEY_LENGTH } from '@hyperfrontend/network-protocol/browser/v4'

// note: 'none' is the local default; v3/v4 register a network-protocol provider on the broker and return per-channel security settings for nexus.

/**
 * Wraps a network-protocol provider in the shape the broker registry expects.
 *
 * @param protocolProvider - The protocol instance factory driving the session envelope.
 * @returns The provider the broker attaches to negotiated channels.
 */
function toSecurityProvider(protocolProvider: SecurityProtocolProvider): SecurityProvider {
  return { createChannel, protocolProvider }
}

/**
 * Rejects a pre-shared key given with a protocol that takes none.
 *
 * @param protocol - The selected protocol.
 * @param sharedKey - The key the caller supplied, if any.
 * @throws {Error} When a key accompanies a protocol other than `v4`.
 */
function rejectStrayKey(protocol: SecurityProtocol, sharedKey: string | undefined): void {
  // why: A key handed to a protocol that never reads it is a misconfiguration the caller would otherwise never learn about, and it suggests the caller expected key-bound security it is not getting.
  if (sharedKey !== undefined) {
    throw createError(
      `Security protocol '${protocol}' takes no pre-shared key; only 'v4' does. Remove the "sharedKey" option or select 'v4'.`
    )
  }
}

/**
 * Registers the selected security protocol on the broker and builds channel settings.
 *
 * The returned settings opt the channel into security negotiation during the
 * connection handshake and make it fail-closed: the channel opens on the
 * selected protocol or not at all. Both sides must select the same protocol
 * (and, for `v4`, hold the same key) for the session to open.
 *
 * @param broker - The nexus broker for this side of the connection.
 * @param protocol - The selected protocol, or `undefined`/`none` for no security.
 * @param sharedKey - The pre-shared key the `v4` protocol binds the session to; at least 16 characters.
 * @returns The nexus channel settings to apply, or `undefined` when unsecured.
 * @throws {Error} When `protocol` is `v4` and the key is missing or shorter than 16 characters, or when a key accompanies any other protocol.
 *
 * @example Enabling the v4 envelope
 * ```typescript
 * const settings = registerSecurity(broker, 'v4', 'a-key-of-sixteen-or-more')
 * broker.addChannel('feature', target, settings)
 * ```
 */
export function registerSecurity(
  broker: BrokerHandle,
  protocol: SecurityProtocol | undefined,
  sharedKey: string | undefined
): Record<string, unknown> | undefined {
  if (protocol === 'v4') {
    // why: An absent or short key would bind the session to nothing worth the name, so misconfiguration fails here in the caller's frame instead of deep inside the protocol.
    if (!isValidSharedKey(sharedKey)) {
      throw createError(
        `Security protocol 'v4' requires a pre-shared key of at least ${MIN_SHARED_KEY_LENGTH} characters: set the "sharedKey" option.`
      )
    }
    broker.registerProtocol('v4', toSecurityProvider(createV4Protocol(broker.logger, sharedKey)))
    return { security: { protocol: 'v4', mode: 'fail-closed' } }
  }
  if (protocol === 'v3') {
    rejectStrayKey(protocol, sharedKey)
    broker.registerProtocol('v3', toSecurityProvider(createV3Protocol(broker.logger)))
    return { security: { protocol: 'v3', mode: 'fail-closed' } }
  }
  rejectStrayKey(protocol ?? 'none', sharedKey)
  return undefined
}
