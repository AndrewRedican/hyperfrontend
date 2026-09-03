import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'
import { encryptionConfig } from '../encryption-config'

/**
 * Creates an encryption function that encrypts messages using AES-GCM with password-derived keys.
 * Generates random salt and initialization vector (IV) for each encryption operation.
 *
 * @param utf8StringToUint8Array - Function to convert UTF-8 strings to byte arrays
 * @param getRandomValues - Function to generate cryptographically secure random values
 * @param generateKey - Function to derive encryption keys from passwords
 * @param subtle - The SubtleCrypto interface for cryptographic operations
 * @returns A function that encrypts messages with passwords
 *
 * @example Encrypting sensitive data
 * ```typescript
 * const encrypt = createEncrypt(utf8StringToUint8Array, getRandomValues, generateKey, crypto.subtle)
 * const encrypted = await encrypt('sensitive-data', 'user-password')
 * ```
 */
export function createEncrypt(
  utf8StringToUint8Array: (text: string) => Uint8Array,
  getRandomValues: (byteLength: number) => Uint8Array,
  generateKey: (password: string, salt: Uint8Array) => Promise<CryptoKey>,
  subtle: SubtleCrypto
): (message: string, password: string) => Promise<Uint8Array> {
  return async function encrypt(message, password) {
    if (!message) {
      throw createError('Cannot encrypt an empty message.')
    }
    if (!password) {
      throw createError('Cannot encrypt without a password.')
    }
    const salt = getRandomValues(16)
    const iv = getRandomValues(12)
    const key = await generateKey(password, salt)
    const encryptedContent = await subtle.encrypt(
      { ...encryptionConfig, iv: iv as unknown as ArrayBuffer },
      key,
      utf8StringToUint8Array(message) as BufferSource
    )
    const buffer = createUint8Array(encryptedContent)
    const result = createUint8Array(salt.byteLength + iv.byteLength + buffer.byteLength)
    result.set(salt, 0)
    result.set(iv, salt.byteLength)
    result.set(buffer, salt.byteLength + iv.byteLength)
    return result
  }
}
