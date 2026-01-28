/**
 * Converts a Uint8Array to a Latin-1 "binary string" where
 * each byte becomes a single charCode (0-255).
 *
 * Use only for binary <-> base64 interop in browsers.
 */
export function bytesToBinaryString(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return binary
}
