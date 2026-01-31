/**
 * Generates cryptographically secure random values using Web Crypto API (browser implementation).
 *
 * @param byteLength - The number of random bytes to generate
 * @returns A Uint8Array containing the random bytes
 * @throws {Error} When byteLength is not provided or is zero
 */
export function getRandomValues(byteLength: number): Uint8Array {
  if (!byteLength) {
    throw new Error('Cannot generate random values without a byte length.')
  }
  return window.crypto.getRandomValues(new Uint8Array(byteLength))
}
