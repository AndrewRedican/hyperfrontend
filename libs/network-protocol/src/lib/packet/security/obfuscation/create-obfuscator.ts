import type { PacketObfuscater, SerializedEncryptedPacket, ObfuscatedPacket } from '../../model'
import { isValidSerializedEncryptedPacket } from '../../validations/is-valid-serialized-encrypted-packet'

/**
 * Creates a packet obfuscator with the provided encryption implementation.
 *
 * @param encrypt - Function that encrypts a string with a password, returning encrypted bytes
 * @returns A PacketObfuscater function that obfuscates serialized encrypted packets
 *
 * @example
 * ```typescript
 * import { encrypt } from '@hyperfrontend/cryptography/browser'
 * import { createPacketObfuscator } from '@hyperfrontend/network-protocol/lib/packet/security/obfuscation/create-packet-obfuscator'
 *
 * const obfuscatePacket = createPacketObfuscator(encrypt)
 * const obfuscated = await obfuscatePacket(packet, 'password')
 * ```
 */
export function createPacketObfuscator(encrypt: (message: string, password: string) => Promise<Uint8Array>): PacketObfuscater {
  return async (packet: SerializedEncryptedPacket, password: string): Promise<ObfuscatedPacket> => {
    if (!isValidSerializedEncryptedPacket(packet)) {
      throw new Error('Cannot obfuscate an invalid packet')
    }
    let text: string
    try {
      text = JSON.stringify(packet)
    } catch {
      throw new Error('Cannot obfuscate packet because it is not serializable')
    }
    let encrypted: Uint8Array
    try {
      encrypted = await encrypt(text, password)
    } catch (e) {
      throw new Error(`Cannot obfuscate packet. ${(e as Error)?.message}`)
    }
    return encrypted
  }
}
