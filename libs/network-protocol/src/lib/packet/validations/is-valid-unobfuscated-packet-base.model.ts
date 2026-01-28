import type { UnobfuscatedPacket } from '../model'

export interface ValidUnobfuscatedPacketBaseResult {
  isValid: boolean
  pkt: UnobfuscatedPacket
}
