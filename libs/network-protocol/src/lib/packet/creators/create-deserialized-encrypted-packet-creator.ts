import type { UnserializedEncryptedPacket, SerializedEncryptedPacket, PacketDeserialization } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isValidSerializedEncryptedPacket } from '../validations/is-valid-serialized-encrypted-packet'

/**
 * Creates a deserialized encrypted packet creator with the provided decoding implementation.
 *
 * @param base64ToUint8Array - Function that converts base64 string to Uint8Array
 * @returns A PacketDeserialization function that deserializes encrypted packet data
 *
 * @example Creating a deserialized encrypted packet
 * ```typescript
 * import { base64ToUint8Array } from '@hyperfrontend/string-utils/browser'
 * import { createDeserializedEncryptedPacketCreator } from '@hyperfrontend/network-protocol/lib/packet/creators/create-deserialized-encrypted-packet-creator'
 *
 * const createDeserializedEncryptedPacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
 * const deserialized = createDeserializedEncryptedPacket(serializedPacket)
 * ```
 */
export function createDeserializedEncryptedPacketCreator(
  base64ToUint8Array: (base64: string, urlSafe?: boolean) => Uint8Array
): PacketDeserialization {
  return (packet: SerializedEncryptedPacket): UnserializedEncryptedPacket => {
    if (!isValidSerializedEncryptedPacket(packet)) {
      throw createError('Cannot deserialize data of an invalid packet')
    }
    let data: Uint8Array
    try {
      data = base64ToUint8Array(packet.data)
    } catch (e) {
      throw createError(`Cannot deserialize packet encrypted data. ${(<Error>e)?.message}`)
    }
    return freeze({ ...packet, data })
  }
}
