import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { encryptionConfig } from '../encryption-config'

/**
 * Creates a decryption function that decrypts AES-GCM encrypted messages using password-derived keys.
 * Extracts salt and IV from the encrypted data to derive the correct decryption key.
 *
 * @param arrayBufferToUtf8String - Function to convert byte arrays to UTF-8 strings
 * @param generateKey - Function to derive decryption keys from passwords
 * @param subtle - The SubtleCrypto interface for cryptographic operations
 * @returns A function that decrypts encrypted messages with passwords
 *
 * @example Decrypting encrypted data
 * ```typescript
 * const decrypt = createDecrypt(arrayBufferToUtf8String, generateKey, crypto.subtle)
 * const plaintext = await decrypt(encryptedData, 'user-password')
 * ```
 */
export function createDecrypt(
  arrayBufferToUtf8String: (bytes: ArrayBuffer) => string,
  generateKey: (password: string, salt: Uint8Array) => Promise<CryptoKey>,
  subtle: SubtleCrypto
): (encrypted: Uint8Array, password: string) => Promise<string> {
  return async function decrypt(encrypted, password) {
    if (!encrypted || !encrypted.length) {
      throw createError('Cannot decrypt without a message')
    }
    if (!password) {
      throw createError('Cannot decrypt without a password')
    }
    const salt = encrypted.slice(0, 16)
    const iv = encrypted.slice(16, 28)
    const data = encrypted.slice(28)
    const key = await generateKey(password, salt)
    const decryptedContent = await subtle.decrypt({ ...encryptionConfig, iv }, key, data)
    return arrayBufferToUtf8String(decryptedContent)
  }
}
