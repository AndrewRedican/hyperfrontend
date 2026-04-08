import { isValidUnencryptedData } from '../../data/validations/is-valid-unencrypted-data'
import { isValidUnobfuscatedPacketBase } from './is-valid-unobfuscated-packet-base'

/**
 * Validates whether the provided value is a valid unencrypted packet.
 * Checks both the packet structure and that the data payload is unencrypted.
 *
 * @param packet - The value to validate as an unencrypted packet
 * @returns True if the value is a valid unencrypted packet, false otherwise
 *
 * @example
 * ```typescript
 * isValidUnencryptedPacket({
 *   origin: '550e8400-e29b-41d4-a716-446655440000',
 *   target: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
 *   data: { key: 'session-abc', message: { action: 'ping' } }
 * })
 * // => true
 * ```
 */
export function isValidUnencryptedPacket(packet: unknown): boolean {
  const { isValid, pkt } = isValidUnobfuscatedPacketBase(packet)
  return isValid && isValidUnencryptedData(pkt.data)
}
