import { fromCharCode } from '@hyperfrontend/immutable-api-utils/built-in-copy/string'

/**
 * Converts a Uint8Array to a Latin-1 "binary string" where
 * each byte becomes a single charCode (0-255).
 *
 * Use only for binary <-> base64 interop in browsers.
 *
 * @param bytes - The Uint8Array to convert
 * @returns A Latin-1 binary string representation
 *
 * @example Converting bytes to binary string
 * ```typescript
 * const bytes = new Uint8Array([72, 101, 108, 108, 111])
 * const binaryStr = bytesToBinaryString(bytes)
 * // => 'Hello'
 * ```
 */
export function bytesToBinaryString(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += fromCharCode(bytes[i])
  }
  return binary
}
