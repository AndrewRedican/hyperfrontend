/**
 * Validates whether the provided value is a valid obfuscated packet.
 * Obfuscated packets must be Uint8Array instances.
 *
 * @param packet - The value to validate as an obfuscated packet
 * @returns True if the value is a Uint8Array, false otherwise
 *
 * @example
 * ```typescript
 * isValidObfuscatedPacket(new Uint8Array([1, 2, 3]))
 * // => true
 *
 * isValidObfuscatedPacket({ data: 'not binary' })
 * // => false
 * ```
 */
export function isValidObfuscatedPacket(packet: unknown): boolean {
  return !!packet && packet instanceof Uint8Array
}
