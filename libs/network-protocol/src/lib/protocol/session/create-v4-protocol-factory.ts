import type { Logger } from '@hyperfrontend/logging'
import type { ProtocolProvider } from '../../channel/model'
import type { SessionCrypto } from './model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSessionProtocolProvider } from './create-session-protocol-provider'

/** The v4 protocol's negotiated identifier and frame version byte */
export const V4 = freeze({ id: 'v4', version: 4 } as const)

/** The shortest shared key v4 accepts; the guarantee needs a generated key of 128 bits or more */
export const MIN_SHARED_KEY_LENGTH = 16

/**
 * Checks that a value can serve as a v4 shared key.
 *
 * @param sharedKey - The value to check
 * @returns True for a string of at least 16 characters
 *
 * @example Validating a key before creating the provider
 * ```typescript
 * isValidSharedKey('k3y-that-is-long-enough')
 * // => true
 * ```
 */
export function isValidSharedKey(sharedKey: unknown): sharedKey is string {
  return typeof sharedKey === 'string' && sharedKey.length >= MIN_SHARED_KEY_LENGTH
}

/**
 * Creates the v4 protocol factory for a platform.
 *
 * v4 keys each session from the same ephemeral key agreement as v3 with the shared key
 * stretched once and mixed in, so a party without the key cannot complete the agreement:
 * product traffic is confidential and authentic against anyone who lacks the key, and a
 * key that leaks later does not expose earlier sessions. A party that can run a hello
 * exchange against this side can test key guesses offline afterwards, which is why the key
 * must be generated, not chosen.
 *
 * @param crypto - The platform primitives
 * @returns `createProtocol(logger, sharedKey)`, which returns the provider a channel binds to a session
 * @throws {Error} When the shared key is shorter than 16 characters
 *
 * @example Composing v4 in a browser entry
 * ```typescript
 * export const createProtocol = createV4ProtocolFactory(crypto)
 * const protocolProvider = createProtocol(logger, sharedKey)
 * ```
 */
export function createV4ProtocolFactory(crypto: SessionCrypto): (logger: Logger, sharedKey: string) => ProtocolProvider {
  return (logger, sharedKey) => {
    if (!isValidSharedKey(sharedKey)) {
      throw createError(`Cannot create the v4 protocol without a shared key of at least ${MIN_SHARED_KEY_LENGTH} characters`)
    }
    return createSessionProtocolProvider(crypto, { ...V4, sharedKey }, logger)
  }
}
