import { isValidUnencryptedData } from '../../data/validations/is-valid-unencrypted-data'
import { isValidUnobfuscatedPacketBase } from './is-valid-unobfuscated-packet-base'

export function isValidUnencryptedPacket(packet: unknown): boolean {
  const { isValid, pkt } = isValidUnobfuscatedPacketBase(packet)
  return isValid && isValidUnencryptedData(pkt.data)
}
