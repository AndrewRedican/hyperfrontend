import { isValidSerializedData } from '../../data/validations/is-valid-serialized-data'
import { isValidUnobfuscatedPacketBase } from './is-valid-unobfuscated-packet-base'

/**
 * Disambiguation: This methods confirms that value for data property in packet is serialized,
 * it does not confirm that the entire packet is serialized
 *
 * @param packet - The value to validate as a serialized encrypted packet
 * @returns True if the packet has valid structure and serialized data, false otherwise
 *
 * @example Validating serialized encrypted packets
 * ```typescript
 * isValidSerializedEncryptedPacket({
 *   origin: '550e8400-e29b-41d4-a716-446655440000',
 *   target: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
 *   data: { key: 'abc', message: '{"action":"ping"}' }
 * })
 * // => true
 * ```
 */
export function isValidSerializedEncryptedPacket(packet: unknown): boolean {
  const { isValid, pkt } = isValidUnobfuscatedPacketBase(packet)
  return isValid && isValidSerializedData(pkt.data)
}
