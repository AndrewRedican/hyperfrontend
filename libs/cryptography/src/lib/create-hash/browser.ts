import type { HashAlgorithm } from './model'
import { utf8StringToUint8Array } from '@hyperfrontend/string-utils/browser'
import { subtle } from '../subtle/browser'

export async function createHash(data: string, algorithm: HashAlgorithm = 'SHA-256'): Promise<string> {
  try {
    return Array.from(new Uint8Array(await subtle.digest(algorithm, <BufferSource>utf8StringToUint8Array(data))))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    throw new Error('Error creating hash')
  }
}
