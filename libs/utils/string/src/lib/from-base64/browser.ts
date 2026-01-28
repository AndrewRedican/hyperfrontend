import { binaryStringToBytes, urlSafeBase64ToBase64 } from '../utils'

export function fromBase64(base64: string): string {
  return new TextDecoder().decode(binaryStringToBytes(atob(urlSafeBase64ToBase64(base64))))
}
