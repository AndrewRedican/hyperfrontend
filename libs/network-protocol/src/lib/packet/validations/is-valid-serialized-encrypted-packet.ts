import { isValidSerializedData } from '../../data/validations/is-valid-serialized-data'
import { isValidUnobfuscatedPacketBase } from './is-valid-unobfuscated-packet-base'

/**
 * Disambiguation: This methods confirms that value for data property in packet is serialized,
 * it does not confirm that the entire packet is serialized
 */
export function isValidSerializedEncryptedPacket(packet: unknown): boolean {
  const { isValid, pkt } = isValidUnobfuscatedPacketBase(packet)
  return isValid && isValidSerializedData(pkt.data)
}
