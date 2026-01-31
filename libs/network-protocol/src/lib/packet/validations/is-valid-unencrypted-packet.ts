import { isValidUnencryptedData } from '../../data/validations/is-valid-unencrypted-data'
import { isValidUnobfuscatedPacketBase } from './is-valid-unobfuscated-packet-base'

/**
 * Validates whether the provided value is a valid unencrypted packet.
 * Checks both the packet structure and that the data payload is unencrypted.
 *
 * @param packet - The value to validate as an unencrypted packet
 * @returns True if the value is a valid unencrypted packet, false otherwise
 */
export function isValidUnencryptedPacket(packet: unknown): boolean {
  const { isValid, pkt } = isValidUnobfuscatedPacketBase(packet)
  return isValid && isValidUnencryptedData(pkt.data)
}
