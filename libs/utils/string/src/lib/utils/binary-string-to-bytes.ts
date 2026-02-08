/**
 * Converts a Latin-1 "binary string" to Uint8Array.
 *
 * Truncates code units above 255 (U+0100+). Not unicode-safe.
 *
 * @param binaryStr - The Latin-1 binary string to convert
 * @returns A Uint8Array containing the byte values from the string
 */
export function binaryStringToBytes(binaryStr: string) {
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i += 1) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return bytes
}
