import { encryptionConfig } from '../encryption-config'

/** Nonce length AES-GCM is specified for: 96 bits */
export const NONCE_LENGTH = 12

/** Authentication tag length AES-GCM appends: 128 bits */
export const TAG_LENGTH = 16

/**
 * Checks that a value is a `CryptoKey` for the library's AEAD algorithm.
 *
 * @param key - The value to check
 * @returns True when the key was created for AES-GCM
 *
 * @example Guarding a key before use
 * ```typescript
 * isAeadKey(await expandKey(secret, salt, info, ['encrypt']))
 * // => true
 * ```
 */
export function isAeadKey(key: unknown): key is CryptoKey {
  return typeof key === 'object' && key !== null && (key as CryptoKey).algorithm?.name === encryptionConfig.name
}
