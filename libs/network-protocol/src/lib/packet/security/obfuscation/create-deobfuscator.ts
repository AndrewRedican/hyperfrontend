import type { PacketDeobfuscater, SerializedEncryptedPacket, ObfuscatedPacket } from '../../model'
import { isValidObfuscatedPacket } from '../../validations/validations'

/**
 * Creates a packet deobfuscator with the provided decryption implementation.
 *
 * @param decrypt - Function that decrypts encrypted bytes with a password, returning the original string
 * @returns A PacketDeobfuscater function that deobfuscates obfuscated packets
 *
 * @example
 * ```typescript
 * import { decrypt } from '@hyperfrontend/cryptography/browser'
 * import { createPacketDeobfuscator } from '@hyperfrontend/network-protocol/lib/packet/security/obfuscation'
 *
 * const deobfuscatePacket = createPacketDeobfuscator(decrypt)
 * const deobfuscated = await deobfuscatePacket(obfuscatedPacket, 'password')
 * ```
 */
export function createPacketDeobfuscator(decrypt: (encrypted: Uint8Array, password: string) => Promise<string>): PacketDeobfuscater {
  return async (packet: ObfuscatedPacket, password: string): Promise<SerializedEncryptedPacket> => {
    if (!isValidObfuscatedPacket(packet)) {
      throw new Error('Cannot deobfuscate an invalid packet')
    }
    let deobfuscated: string
    try {
      deobfuscated = await decrypt(packet, password)
    } catch (e) {
      throw new Error(`Cannot deobfuscate packet. ${(e as Error)?.message}`)
    }

    let deserialized: SerializedEncryptedPacket
    try {
      deserialized = JSON.parse(deobfuscated)
    } catch {
      throw new Error('Cannot deobfuscate packet because cannot deserialize decrypted data')
    }
    return Object.freeze(deserialized)
  }
}
