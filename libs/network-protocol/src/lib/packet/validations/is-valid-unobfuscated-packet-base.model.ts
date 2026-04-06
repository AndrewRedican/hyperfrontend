import type { UnobfuscatedPacket } from '../model'

/**
 * Result of validating an unobfuscated packet base.
 */
export interface ValidUnobfuscatedPacketBaseResult {
  /** Whether the packet is valid */
  isValid: boolean
  /** The validated unobfuscated packet */
  pkt: UnobfuscatedPacket
}
