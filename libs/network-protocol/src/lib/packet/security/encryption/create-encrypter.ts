import type { Data } from '../../../data/model'
import type { PacketEncrypter, UnserializedEncryptedPacket, UnencryptedPacket } from '../../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isValidUnencryptedPacket } from '../../validations/is-valid-unencrypted-packet'

/**
 * Creates a packet encrypter with the provided data encryption implementation.
 *
 * @param encryptData - Function that encrypts Data objects with a password, returning encrypted bytes
 * @returns A PacketEncrypter function that encrypts unencrypted packets
 *
 * @example Creating a packet encrypter
 * ```typescript
 * import { createDataEncrypter } from '@hyperfrontend/network-protocol/lib/data/security/create-data-encrypter'
 * import { encrypt } from '@hyperfrontend/cryptography/browser'
 * import { createPacketEncrypter } from '@hyperfrontend/network-protocol/lib/packet/security/encryption/create-packet-encrypter'
 *
 * const encryptData = createDataEncrypter(encrypt)
 * const encryptPacket = createPacketEncrypter(encryptData)
 * const encrypted = await encryptPacket(packet, 'password')
 * ```
 */
export function createPacketEncrypter<T = unknown>(encryptData: (data: Data<T>, password: string) => Promise<Uint8Array>): PacketEncrypter {
  return async (packet: UnencryptedPacket, password: string): Promise<UnserializedEncryptedPacket> => {
    if (!isValidUnencryptedPacket(packet)) {
      throw createError('Cannot encrypt invalid packet')
    }
    let unserializedEncryptedPacket: UnserializedEncryptedPacket
    try {
      unserializedEncryptedPacket = {
        ...packet,
        data: await encryptData(packet.data, password),
      }
    } catch (e) {
      throw createError(`Cannot encrypt packet. ${(e as Error)?.message}`)
    }
    return freeze(unserializedEncryptedPacket)
  }
}
