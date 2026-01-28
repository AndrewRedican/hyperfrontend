import { encryptionConfig } from '../encryption-config'

export function createDecrypt(
  arrayBufferToUtf8String: (bytes: ArrayBuffer) => string,
  generateKey: (password: string, salt: Uint8Array) => Promise<CryptoKey>,
  subtle: SubtleCrypto
): (encrypted: Uint8Array, password: string) => Promise<string> {
  return async function decrypt(encrypted, password) {
    if (!encrypted || !encrypted.length) {
      throw new Error('Cannot decrypt without a message')
    }
    if (!password) {
      throw new Error('Cannot decrypt without a password')
    }
    const salt = encrypted.slice(0, 16)
    const iv = encrypted.slice(16, 28)
    const data = encrypted.slice(28)
    const key = await generateKey(password, salt)
    const decryptedContent = await subtle.decrypt({ ...encryptionConfig, iv }, key, data)
    return arrayBufferToUtf8String(decryptedContent)
  }
}
