import { getType } from '@hyperfrontend/data-utils'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { encryptionConfig } from '../encryption-config'
import { keyStretchingConfig } from '../key-stretching-config'

/**
 * Creates a key generator function that derives encryption keys from passwords using PBKDF2.
 * Uses the library-wide stretching parameters (100,000 SHA-256 iterations).
 *
 * @param subtle - The SubtleCrypto interface for cryptographic operations
 * @param utf8StringToUint8Array - Function to convert UTF-8 strings to byte arrays
 * @returns A function that generates CryptoKey instances from passwords and salts
 *
 * @example Generating an encryption key
 * ```typescript
 * const generateKey = createKeyGenerator(crypto.subtle, utf8StringToUint8Array)
 * const salt = getRandomValues(16)
 * const key = await generateKey('user-password', salt)
 * ```
 */
export function createKeyGenerator(
  subtle: SubtleCrypto,
  utf8StringToUint8Array: (text: string) => Uint8Array
): (password: string, salt: Uint8Array) => Promise<CryptoKey> {
  return async function generateKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    if (getType(password) !== 'string') {
      throw createError('Cannot generate key without a password type string')
    }
    if (password.length === 0) {
      throw createError('Cannot generate key with an empty string as password')
    }
    if (!salt) {
      throw createError('Cannot generate key without a salt')
    }
    const keyMaterial = await subtle.importKey(
      'raw',
      utf8StringToUint8Array(password) as BufferSource,
      { name: keyStretchingConfig.name },
      false,
      ['deriveKey']
    )
    return subtle.deriveKey(
      {
        name: keyStretchingConfig.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        salt: salt as any,
        iterations: keyStretchingConfig.iterations,
        hash: keyStretchingConfig.hash,
      },
      keyMaterial,
      { ...encryptionConfig, length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }
}
