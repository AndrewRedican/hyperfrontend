import type { DataEncrypter } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/**
 * Creates a data encrypter function with the provided encryption implementation.
 *
 * @param encrypt - Function that encrypts a string with a password, returning encrypted bytes
 * @returns A DataEncrypter function
 *
 * @example Creating an encrypter with custom implementation
 * ```typescript
 * const encrypter = createDataEncrypter(async (message, password) => encryptString(message, password))
 * const encrypted = await encrypter({ userId: 123 }, 'secretPassword')
 * ```
 */
export function createDataEncrypter(encrypt: (message: string, password: string) => Promise<Uint8Array>): DataEncrypter {
  return async (data, password) => {
    const dataType = getType(data)
    if (dataType !== 'object' && dataType !== 'array') {
      throw createError('Cannot encrypt non existent or invalid data')
    }
    if (getType(password) !== 'string' || password.length === 0) {
      throw createError('Cannot encrypt data without a password')
    }
    let serialized: string
    try {
      serialized = stringify(data)
    } catch {
      throw createError('Cannot encrypt data because it is unserializable')
    }
    let encrypted: Uint8Array
    try {
      encrypted = await encrypt(serialized, password)
    } catch {
      throw createError('Cannot encrypt data')
    }
    return encrypted
  }
}
