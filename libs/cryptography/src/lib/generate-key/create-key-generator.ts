import { getType } from '@hyperfrontend/data-utils'
import { encryptionConfig } from '../encryption-config'

export function createKeyGenerator(
  subtle: SubtleCrypto,
  utf8StringToUint8Array: (text: string) => Uint8Array
): (password: string, salt: Uint8Array) => Promise<CryptoKey> {
  return async function generateKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    if (getType(password) !== 'string') {
      throw new Error('Cannot generate key without a password type string')
    }
    if (password.length === 0) {
      throw new Error('Cannot generate key with an empty string as password')
    }
    if (!salt) {
      throw new Error('Cannot generate key without a salt')
    }
    const keyMaterial = await subtle.importKey('raw', <BufferSource>utf8StringToUint8Array(password), { name: 'PBKDF2' }, false, [
      'deriveKey',
    ])
    return subtle.deriveKey(
      {
        name: 'PBKDF2',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        salt: <any>salt,
        iterations: 100_000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { ...encryptionConfig, length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }
}
