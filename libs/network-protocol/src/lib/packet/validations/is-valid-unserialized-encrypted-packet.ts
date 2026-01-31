import { isValidUnserializedData } from '../../data/validations/is-valid-unserialized-data'
import { isValidUnobfuscatedPacketBase } from './is-valid-unobfuscated-packet-base'

/**
 * Validates whether the provided value is a valid unserialized encrypted packet.
 * Checks that the packet has valid structure and the data is in unserialized format (Uint8Array).
 *
 * @param packet - The value to validate as an unserialized encrypted packet
 * @returns True if the packet has valid structure and unserialized data, false otherwise
 */
export function isValidUnserializedEncryptedPacket(packet: unknown): boolean {
  const { isValid, pkt } = isValidUnobfuscatedPacketBase(packet)
  return isValid && isValidUnserializedData(pkt.data)
}
