import type { UnserializedEncryptedPacket, SerializedEncryptedPacket, PacketDeserialization } from '../model'
import { isValidSerializedEncryptedPacket } from '../validations/validations'

/**
 * Creates a deserialized encrypted packet creator with the provided decoding implementation.
 *
 * @param base64ToUint8Array - Function that converts base64 string to Uint8Array
 * @returns A PacketDeserialization function that deserializes encrypted packet data
 *
 * @example
 * ```typescript
 * import { base64ToUint8Array } from '@hyperfrontend/string-utils/browser'
 * import { createDeserializedEncryptedPacketCreator } from '@hyperfrontend/network-protocol/lib/packet/creators/creators'
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
      throw new Error('Cannot deserialize data of an invalid packet')
    }
    let data: Uint8Array
    try {
      data = base64ToUint8Array(packet.data)
    } catch (e) {
      throw new Error(`Cannot deserialize packet encrypted data. ${(e as Error)?.message}`)
    }
    return Object.freeze({ ...packet, data })
  }
}
