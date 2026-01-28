import type { DataEncrypter } from '../model'
import { getType } from '@hyperfrontend/data-utils'

/**
 * Creates a data encrypter function with the provided encryption implementation.
 *
 * @param encrypt - Function that encrypts a string with a password, returning encrypted bytes
 * @returns A DataEncrypter function
 */
export function createDataEncrypter(encrypt: (message: string, password: string) => Promise<Uint8Array>): DataEncrypter {
  return async (data, password) => {
    const dataType = getType(data)
    if (dataType !== 'object' && dataType !== 'array') {
      throw new Error('Cannot encrypt non existent or invalid data')
    }
    if (getType(password) !== 'string' || password.length === 0) {
      throw new Error('Cannot encrypt data without a password')
    }
    let serialized: string
    try {
      serialized = JSON.stringify(data)
    } catch {
      throw new Error('Cannot encrypt data because it is unserializable')
    }
    let encrypted: Uint8Array
    try {
      encrypted = await encrypt(serialized, password)
    } catch {
      throw new Error('Cannot encrypt data')
    }
    return encrypted
  }
}
