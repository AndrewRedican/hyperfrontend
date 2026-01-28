import { bytesToBinaryString, base64ToUrlSafeBase64 } from '../utils'

export function uint8ArrayToBase64(bytes: Uint8Array, urlSafe = false, keepPadding = false): string {
  return base64ToUrlSafeBase64(btoa(bytesToBinaryString(bytes)), {
    urlSafe,
    keepPadding,
  })
}
