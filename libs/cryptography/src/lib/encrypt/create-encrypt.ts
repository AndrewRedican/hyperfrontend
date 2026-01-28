import { encryptionConfig } from '../encryption-config'

export function createEncrypt(
  utf8StringToUint8Array: (text: string) => Uint8Array,
  getRandomValues: (byteLength: number) => Uint8Array,
  generateKey: (password: string, salt: Uint8Array) => Promise<CryptoKey>,
  subtle: SubtleCrypto
): (message: string, password: string) => Promise<Uint8Array> {
  return async function encrypt(message, password) {
    if (!message) {
      throw new Error('Cannot encrypt an empty message.')
    }
    if (!password) {
      throw new Error('Cannot encrypt without a password.')
    }
    const salt = getRandomValues(16)
    const iv = getRandomValues(12)
    const key = await generateKey(password, salt)
    const encryptedContent = await subtle.encrypt(
      { ...encryptionConfig, iv: <ArrayBuffer>(<unknown>iv) },
      key,
      <BufferSource>utf8StringToUint8Array(message)
    )
    const buffer = new Uint8Array(encryptedContent)
    const result = new Uint8Array(salt.byteLength + iv.byteLength + buffer.byteLength)
    result.set(salt, 0)
    result.set(iv, salt.byteLength)
    result.set(buffer, salt.byteLength + iv.byteLength)
    return result
  }
}
