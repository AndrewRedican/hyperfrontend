import type { DataDecrypter, SerializedData } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Creates a data decrypter function with the provided decryption implementation.
 *
 * @param decrypt - Function that decrypts encrypted bytes with a password, returning the original string
 * @returns A DataDecrypter function
 */
export function createDataDecrypter(decrypt: (encrypted: Uint8Array, password: string) => Promise<string>): DataDecrypter {
  return async <T = unknown>(data: Uint8Array, password: string): Promise<SerializedData<T>> => {
    if (!(data instanceof Uint8Array)) {
      throw new Error('Cannot decrypt data because it is in the wrong format')
    }
    if (getType(password) !== 'string' || password.length === 0) {
      throw new Error('Cannot decrypt data without a password')
    }
    let decrypted: string
    try {
      decrypted = await decrypt(data, password)
    } catch {
      throw new Error('Cannot decrypt data')
    }
    let deserialized: SerializedData<T>
    try {
      deserialized = parse(decrypted) as SerializedData<T>
    } catch {
      throw new Error('Cannot unserialize data')
    }
    return freeze(deserialized)
  }
}
