import { isValidUnserializedData } from '../../data/validations/is-valid-unserialized-data'
import { isValidUnobfuscatedPacketBase } from './is-valid-unobfuscated-packet-base'

export function isValidUnserializedEncryptedPacket(packet: unknown): boolean {
  const { isValid, pkt } = isValidUnobfuscatedPacketBase(packet)
  return isValid && isValidUnserializedData(pkt.data)
}
