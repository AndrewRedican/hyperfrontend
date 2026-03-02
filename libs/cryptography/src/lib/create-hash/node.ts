import type { HashAlgorithm } from './model'
import { createHash as _createHash } from 'node:crypto'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'

/**
 * Creates a cryptographic hash of the provided data using Node.js crypto module.
 *
 * @param data - The string data to hash
 * @param algorithm - The hash algorithm to use (defaults to SHA-256)
 * @returns A promise that resolves to the hexadecimal hash string
 * @throws {Error} When hash creation fails
 */
export async function createHash(data: string, algorithm: HashAlgorithm = 'SHA-256'): Promise<string> {
  return createPromise((resolve, reject) => {
    try {
      const hash = _createHash(algorithm).update(data).digest('hex')
      resolve(hash)
    } catch {
      reject(createError('Error creating hash'))
    }
  })
}
