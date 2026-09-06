import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { encryptionConfig } from '../encryption-config'

const PERMITTED_USAGES: readonly KeyUsage[] = ['encrypt', 'decrypt']

/**
 * Creates a key-expansion function that turns input key material into a non-extractable
 * AES-GCM-256 `CryptoKey` with HKDF-SHA256.
 *
 * `salt` and `info` bind the key to one context: the same material expanded with a
 * different `info` yields an unrelated key, which is how one agreement produces distinct
 * keys per direction or per purpose. Usages are restricted at derivation, so a key meant
 * only to encrypt can never decrypt.
 *
 * @param subtle - The SubtleCrypto interface for cryptographic operations
 * @returns A function that expands key material into an AES-GCM key
 *
 * @example Deriving one sending key from a shared secret
 * ```typescript
 * const expandKey = createExpandKey(crypto.subtle)
 * const sendKey = await expandKey(sharedSecret, sessionSalt, utf8StringToUint8Array('app/session/send'), ['encrypt'])
 * ```
 */
export function createExpandKey(
  subtle: SubtleCrypto
): (ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, usages: readonly KeyUsage[]) => Promise<CryptoKey> {
  return async function expandKey(ikm, salt, info, usages) {
    if (!(ikm instanceof Uint8Array) || ikm.length === 0) {
      throw createError('Cannot expand a key without input key material')
    }
    if (!(salt instanceof Uint8Array)) {
      throw createError('Cannot expand a key without a salt')
    }
    if (!(info instanceof Uint8Array)) {
      throw createError('Cannot expand a key without context info')
    }
    if (!isArray(usages) || usages.length === 0 || usages.some((usage) => !PERMITTED_USAGES.includes(usage))) {
      throw createError("Key usages must be a non-empty list drawn from 'encrypt' and 'decrypt'")
    }
    const material = await subtle.importKey('raw', ikm as BufferSource, { name: 'HKDF' }, false, ['deriveKey'])
    return subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
      material,
      { ...encryptionConfig, length: 256 },
      false,
      [...usages]
    )
  }
}
