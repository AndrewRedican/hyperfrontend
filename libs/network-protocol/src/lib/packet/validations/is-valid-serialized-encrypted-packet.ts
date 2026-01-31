import { isValidSerializedData } from '../../data/validations/is-valid-serialized-data'
import { isValidUnobfuscatedPacketBase } from './is-valid-unobfuscated-packet-base'

/**
 * Disambiguation: This methods confirms that value for data property in packet is serialized,
 * it does not confirm that the entire packet is serialized
 *
 * @param packet - The value to validate as a serialized encrypted packet
 * @returns True if the packet has valid structure and serialized data, false otherwise
 */
export function isValidSerializedEncryptedPacket(packet: unknown): boolean {
  const { isValid, pkt } = isValidUnobfuscatedPacketBase(packet)
  return isValid && isValidSerializedData(pkt.data)
}
