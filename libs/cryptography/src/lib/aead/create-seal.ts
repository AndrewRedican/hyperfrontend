import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'
import { encryptionConfig } from '../encryption-config'
import { isAeadKey, NONCE_LENGTH } from './guards'

/**
 * Creates a sealing function: AES-GCM authenticated encryption under a caller-supplied key
 * and nonce, with additional data covered by the authentication tag.
 *
 * Unlike `encrypt`, nothing is derived or generated here: the caller manages the key's
 * lifetime and guarantees that a nonce is never reused under the same key. That is the
 * contract that makes a per-session key safe to reuse across many messages.
 *
 * @param subtle - The SubtleCrypto interface for cryptographic operations
 * @returns A function that seals a plaintext
 *
 * @example Sealing one frame of a session
 * ```typescript
 * const seal = createSeal(crypto.subtle)
 * const frame = await seal(sendKey, nonceFor(counter), header, payload)
 * ```
 */
export function createSeal(
  subtle: SubtleCrypto
): (key: CryptoKey, nonce: Uint8Array, additionalData: Uint8Array, plaintext: Uint8Array) => Promise<Uint8Array> {
  return async function seal(key, nonce, additionalData, plaintext) {
    if (!isAeadKey(key)) {
      throw createError('Cannot seal without an AES-GCM key')
    }
    if (!(nonce instanceof Uint8Array) || nonce.length !== NONCE_LENGTH) {
      throw createError(`Cannot seal without a ${NONCE_LENGTH}-byte nonce`)
    }
    if (!(additionalData instanceof Uint8Array)) {
      throw createError('Cannot seal without additional data as a byte array')
    }
    if (!(plaintext instanceof Uint8Array) || plaintext.length === 0) {
      throw createError('Cannot seal an empty plaintext')
    }
    const sealed = await subtle.encrypt(
      { ...encryptionConfig, iv: nonce as BufferSource, additionalData: additionalData as BufferSource },
      key,
      plaintext as BufferSource
    )
    return createUint8Array(sealed)
  }
}
