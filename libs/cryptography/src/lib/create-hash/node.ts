import type { HashAlgorithm } from './model'
import { createHash as _createHash } from 'node:crypto'

export async function createHash(data: string, algorithm: HashAlgorithm = 'SHA-256'): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const hash = _createHash(algorithm).update(data).digest('hex')
      resolve(hash)
    } catch {
      reject(new Error('Error creating hash'))
    }
  })
}
