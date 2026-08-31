import type { PacketDeobfuscater, SerializedEncryptedPacket, ObfuscatedPacket } from '../../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isValidObfuscatedPacket } from '../../validations/is-valid-obfuscated-packet'

/**
 * Creates a packet deobfuscator with the provided decryption implementation.
 *
 * @param decrypt - Function that decrypts encrypted bytes with a password, returning the original string
 * @returns A PacketDeobfuscater function that deobfuscates obfuscated packets
 *
 * @example Creating a packet deobfuscator
 * ```typescript
 * import { decrypt } from '@hyperfrontend/cryptography/browser'
 * import { createPacketDeobfuscator } from '@hyperfrontend/network-protocol/lib/packet/security/obfuscation/create-packet-deobfuscator'
 *
 * const deobfuscatePacket = createPacketDeobfuscator(decrypt)
 * const deobfuscated = await deobfuscatePacket(obfuscatedPacket, 'password')
 * ```
 */
export function createPacketDeobfuscator(decrypt: (encrypted: Uint8Array, password: string) => Promise<string>): PacketDeobfuscater {
  return async (packet: ObfuscatedPacket, password: string): Promise<SerializedEncryptedPacket> => {
    if (!isValidObfuscatedPacket(packet)) {
      throw createError('Cannot deobfuscate an invalid packet')
    }
    let deobfuscated: string
    try {
      deobfuscated = await decrypt(packet, password)
    } catch (e) {
      throw createError(`Cannot deobfuscate packet. ${(e as Error)?.message}`)
    }

    let deserialized: SerializedEncryptedPacket
    try {
      deserialized = parse(deobfuscated)
    } catch {
      throw createError('Cannot deobfuscate packet because cannot deserialize decrypted data')
    }
    return freeze(deserialized)
  }
}
