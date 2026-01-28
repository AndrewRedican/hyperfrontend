import { UTF8_DECODER } from '../shared-consts'

export function uint8ArrayToUtf8String(uint8Array: Uint8Array): string {
  return UTF8_DECODER.decode(uint8Array)
}
