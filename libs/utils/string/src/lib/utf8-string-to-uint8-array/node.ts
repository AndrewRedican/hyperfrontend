/**
 * Converts a UTF-8 string to a Uint8Array (Node.js implementation).
 *
 * @param text - The UTF-8 string to convert
 * @returns The encoded Uint8Array
 */
export function utf8StringToUint8Array(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, 'utf8'))
}
