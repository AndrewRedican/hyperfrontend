import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'
import { encryptionConfig } from '../encryption-config'
import { isAeadKey, NONCE_LENGTH, TAG_LENGTH } from './guards'

/**
 * Creates an opening function: AES-GCM authenticated decryption under a caller-supplied
 * key and nonce, verifying the additional data the sealer covered.
 *
 * A ciphertext, tag, nonce, or additional data that does not match rejects with one
 * error; nothing about which part failed is disclosed.
 *
 * @param subtle - The SubtleCrypto interface for cryptographic operations
 * @returns A function that opens a sealed message
 *
 * @example Opening one frame of a session
 * ```typescript
 * const open = createOpen(crypto.subtle)
 * const payload = await open(receiveKey, nonceFor(counter), header, frame)
 * ```
 */
export function createOpen(
  subtle: SubtleCrypto
): (key: CryptoKey, nonce: Uint8Array, additionalData: Uint8Array, sealed: Uint8Array) => Promise<Uint8Array> {
  return async function open(key, nonce, additionalData, sealed) {
    if (!isAeadKey(key)) {
      throw createError('Cannot open without an AES-GCM key')
    }
    if (!(nonce instanceof Uint8Array) || nonce.length !== NONCE_LENGTH) {
      throw createError(`Cannot open without a ${NONCE_LENGTH}-byte nonce`)
    }
    if (!(additionalData instanceof Uint8Array)) {
      throw createError('Cannot open without additional data as a byte array')
    }
    if (!(sealed instanceof Uint8Array) || sealed.length <= TAG_LENGTH) {
      throw createError('Cannot open a message shorter than its authentication tag')
    }
    let opened: ArrayBuffer
    try {
      opened = await subtle.decrypt(
        { ...encryptionConfig, iv: nonce as BufferSource, additionalData: additionalData as BufferSource },
        key,
        sealed as BufferSource
      )
    } catch {
      throw createError('Cannot open the message: authentication failed')
    }
    return createUint8Array(opened)
  }
}
