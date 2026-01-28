import { urlSafeBase64ToBase64 } from '../utils'

export function base64ToUint8Array(base64: string): Uint8Array {
  const buffer = Buffer.from(urlSafeBase64ToBase64(base64), 'base64')
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
}
