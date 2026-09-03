import type { DataDecrypter, SerializedData } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Creates a data decrypter function with the provided decryption implementation.
 *
 * @param decrypt - Function that decrypts encrypted bytes with a password, returning the original string
 * @returns A DataDecrypter function
 *
 * @example Creating a decrypter with custom implementation
 * ```typescript
 * const decrypter = createDataDecrypter(async (bytes, password) => decryptBytes(bytes, password))
 * const data = await decrypter(encryptedBytes, 'secretPassword')
 * ```
 */
export function createDataDecrypter(decrypt: (encrypted: Uint8Array, password: string) => Promise<string>): DataDecrypter {
  return async <T = unknown>(data: Uint8Array, password: string): Promise<SerializedData<T>> => {
    if (!(data instanceof Uint8Array)) {
      throw createError('Cannot decrypt data because it is in the wrong format')
    }
    if (getType(password) !== 'string' || password.length === 0) {
      throw createError('Cannot decrypt data without a password')
    }
    let decrypted: string
    try {
      decrypted = await decrypt(data, password)
    } catch {
      throw createError('Cannot decrypt data')
    }
    let deserialized: SerializedData<T>
    try {
      deserialized = parse(decrypted) as SerializedData<T>
    } catch {
      throw createError('Cannot unserialize data')
    }
    return freeze(deserialized)
  }
}
