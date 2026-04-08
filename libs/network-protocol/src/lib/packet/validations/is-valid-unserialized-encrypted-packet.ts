import { isValidUnserializedData } from '../../data/validations/is-valid-unserialized-data'
import { isValidUnobfuscatedPacketBase } from './is-valid-unobfuscated-packet-base'

/**
 * Validates whether the provided value is a valid unserialized encrypted packet.
 * Checks that the packet has valid structure and the data is in unserialized format (Uint8Array).
 *
 * @param packet - The value to validate as an unserialized encrypted packet
 * @returns True if the packet has valid structure and unserialized data, false otherwise
 *
 * @example
 * ```typescript
 * isValidUnserializedEncryptedPacket({
 *   origin: '550e8400-e29b-41d4-a716-446655440000',
 *   target: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
 *   data: new Uint8Array([1, 2, 3])
 * })
 * // => true
 * ```
 */
export function isValidUnserializedEncryptedPacket(packet: unknown): boolean {
  const { isValid, pkt } = isValidUnobfuscatedPacketBase(packet)
  return isValid && isValidUnserializedData(pkt.data)
}
