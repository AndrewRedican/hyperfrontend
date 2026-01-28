import type { PacketDecrypter, UnencryptedPacket, UnserializedEncryptedPacket } from '../../model'
import type { Data } from '../../../data'
import { isValidUnserializedEncryptedPacket } from '../../validations'

/**
 * Creates a packet decrypter with the provided data decryption implementation.
 *
 * @param decryptData - Function that decrypts encrypted bytes with a password, returning Data objects
 * @returns A PacketDecrypter function that decrypts encrypted packets
 *
 * @example
 * ```typescript
 * import { createDataDecrypter } from '@hyperfrontend/network-protocol/lib/data/security'
 * import { decrypt } from '@hyperfrontend/cryptography/browser'
 * import { createPacketDecrypter } from '@hyperfrontend/network-protocol/lib/packet/security/encryption'
 *
 * const decryptData = createDataDecrypter(decrypt)
 * const decryptPacket = createPacketDecrypter(decryptData)
 * const decrypted = await decryptPacket(encryptedPacket, 'password')
 * ```
 */
export function createPacketDecrypter<T = unknown>(decryptData: (data: Uint8Array, password: string) => Promise<Data<T>>): PacketDecrypter {
  return async (packet: UnserializedEncryptedPacket, password: string): Promise<UnencryptedPacket> => {
    if (!isValidUnserializedEncryptedPacket(packet)) {
      throw new Error('Cannot decrypt invalid packet')
    }
    let unencryptedPacket: UnencryptedPacket
    try {
      unencryptedPacket = {
        ...packet,
        data: await decryptData(packet.data, password),
      }
    } catch (e) {
      throw new Error(`Cannot decrypt packet. ${(e as Error)?.message}`)
    }
    return Object.freeze(unencryptedPacket)
  }
}
