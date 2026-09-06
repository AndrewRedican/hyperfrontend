import type { StretchPasswordOptions } from './model'
import { getType } from '@hyperfrontend/data-utils'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'
import { keyStretchingConfig } from '../key-stretching-config'

/**
 * Creates a password-stretching function that turns a password and a salt into raw key
 * material with PBKDF2-HMAC-SHA256.
 *
 * The result is bytes rather than a `CryptoKey`, so it can feed a further derivation
 * (`expandKey`) or be combined with other secrets. Callers own the returned buffer and
 * should zero it once it has been consumed.
 *
 * @param subtle - The SubtleCrypto interface for cryptographic operations
 * @param utf8StringToUint8Array - Function to convert UTF-8 strings to byte arrays
 * @returns A function that stretches a password into key material
 *
 * @example Stretching a shared secret once per session
 * ```typescript
 * const stretchPassword = createStretchPassword(crypto.subtle, utf8StringToUint8Array)
 * const material = await stretchPassword('shared-secret-at-least-16', sessionSalt)
 * ```
 */
export function createStretchPassword(
  subtle: SubtleCrypto,
  utf8StringToUint8Array: (text: string) => Uint8Array
): (password: string, salt: Uint8Array, options?: StretchPasswordOptions) => Promise<Uint8Array> {
  return async function stretchPassword(password, salt, options = {}) {
    if (getType(password) !== 'string' || password.length === 0) {
      throw createError('Cannot stretch an empty password')
    }
    if (!(salt instanceof Uint8Array) || salt.length === 0) {
      throw createError('Cannot stretch a password without a salt')
    }
    const { iterations = keyStretchingConfig.iterations, length = 256 } = options
    if (!isInteger(iterations) || iterations < 1) {
      throw createError('Password stretching iterations must be a positive integer')
    }
    if (!isInteger(length) || length < 8 || length % 8 !== 0) {
      throw createError('Password stretching length must be a positive multiple of 8 bits')
    }
    const material = await subtle.importKey(
      'raw',
      utf8StringToUint8Array(password) as BufferSource,
      { name: keyStretchingConfig.name },
      false,
      ['deriveBits']
    )
    const bits = await subtle.deriveBits(
      { name: keyStretchingConfig.name, salt: salt as BufferSource, iterations, hash: keyStretchingConfig.hash },
      material,
      length
    )
    return createUint8Array(bits)
  }
}
