import { UTF8_DECODER } from '../shared-consts'

export function arrayBufferToUtf8String(uint8Array: ArrayBuffer): string {
  return UTF8_DECODER.decode(uint8Array)
}
