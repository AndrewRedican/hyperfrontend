import { base64ToUrlSafeBase64 } from '../utils'

export function uint8ArrayToBase64(bytes: Uint8Array, urlSafe = false, keepPadding = false): string {
  return base64ToUrlSafeBase64(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64'), { urlSafe, keepPadding })
}
