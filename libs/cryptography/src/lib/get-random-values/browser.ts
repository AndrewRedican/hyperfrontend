import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'

/**
 * Generates cryptographically secure random values using Web Crypto API (browser implementation).
 *
 * @param byteLength - The number of random bytes to generate
 * @returns A Uint8Array containing the random bytes
 * @throws {Error} When byteLength is not provided or is zero
 *
 * @example Generating random bytes
 * ```typescript
 * const randomBytes = getRandomValues(16)
 * // => Uint8Array(16) with cryptographically secure random values
 * ```
 */
export function getRandomValues(byteLength: number): Uint8Array {
  if (!byteLength) {
    throw createError('Cannot generate random values without a byte length.')
  }
  return globalThis.crypto.getRandomValues(createUint8Array(byteLength))
}
