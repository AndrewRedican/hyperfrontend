import { base64ToUrlSafeBase64, bytesToBinaryString } from '../utils'

export function toBase64(text: string, urlSafe = false, keepPadding = false): string {
  return base64ToUrlSafeBase64(btoa(bytesToBinaryString(new TextEncoder().encode(text))), { urlSafe, keepPadding })
}
