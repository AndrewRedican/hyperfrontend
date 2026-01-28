import { binaryStringToBytes, urlSafeBase64ToBase64 } from '../utils'

export function base64ToUint8Array(base64: string): Uint8Array {
  return binaryStringToBytes(atob(urlSafeBase64ToBase64(base64)))
}
