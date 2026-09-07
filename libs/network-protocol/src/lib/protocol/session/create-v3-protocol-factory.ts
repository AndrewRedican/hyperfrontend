import type { Logger } from '@hyperfrontend/logging'
import type { ProtocolProvider } from '../../channel/model'
import type { SessionCrypto } from './model'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSessionProtocolProvider } from './create-session-protocol-provider'

/** The v3 protocol's negotiated identifier and frame version byte */
export const V3 = freeze({ id: 'v3', version: 3 } as const)

/**
 * Creates the v3 protocol factory for a platform.
 *
 * v3 keys each session from an ephemeral key agreement alone: a party that only listens
 * to the hello exchange and the traffic cannot read it, while a party that can post its own
 * hello to a window before the peer's arrives can stand in for the peer. It authenticates
 * frames, rejects replays, and binds traffic to one session, but does not authenticate the
 * peer.
 *
 * @param crypto - The platform primitives
 * @returns `createProtocol(logger)`, which returns the provider a channel binds to a session
 *
 * @example Composing v3 in a browser entry
 * ```typescript
 * export const createProtocol = createV3ProtocolFactory(crypto)
 * const protocolProvider = createProtocol(logger)
 * ```
 */
export function createV3ProtocolFactory(crypto: SessionCrypto): (logger: Logger) => ProtocolProvider {
  return (logger) => createSessionProtocolProvider(crypto, V3, logger)
}
