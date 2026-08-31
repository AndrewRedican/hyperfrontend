import type { HashAlgorithm } from './model'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'
import { utf8StringToUint8Array } from '@hyperfrontend/string-utils/browser'
import { subtle } from '../subtle/browser'

/**
 * Creates a cryptographic hash of the provided data using Web Crypto API (browser implementation).
 *
 * @param data - The string data to hash
 * @param algorithm - The hash algorithm to use (defaults to SHA-256)
 * @returns A promise that resolves to the hexadecimal hash string
 * @throws {Error} When hash creation fails
 *
 * @example Creating a hash
 * ```typescript
 * const hash = await createHash('secret-message')
 * // => '64-character hexadecimal string'
 * ```
 */
export async function createHash(data: string, algorithm: HashAlgorithm = 'SHA-256'): Promise<string> {
  try {
    return from(createUint8Array(await subtle.digest(algorithm, utf8StringToUint8Array(data) as BufferSource)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    throw createError('Error creating hash')
  }
}
