import type { UnserializedEncryptedPacket, SerializedEncryptedPacket, PacketSerialization } from '../model'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isValidUnserializedEncryptedPacket } from '../validations/is-valid-unserialized-encrypted-packet'

/**
 * Creates a serialized encrypted packet creator with the provided encoding implementation.
 *
 * @param uint8ArrayToBase64 - Function that converts Uint8Array to base64 string
 * @returns A PacketSerialization function that serializes encrypted packet data
 *
 * @example
 * ```typescript
 * import { uint8ArrayToBase64 } from '@hyperfrontend/string-utils/browser'
 * import { createSerializedEncryptedPacketCreator } from '@hyperfrontend/network-protocol/lib/packet/creators/create-serialized-encrypted-packet-creator'
 *
 * const createSerializedEncryptedPacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
 * const serialized = createSerializedEncryptedPacket(unserializedPacket)
 * ```
 */
export function createSerializedEncryptedPacketCreator(
  uint8ArrayToBase64: (bytes: Uint8Array, urlSafe?: boolean, keepPadding?: boolean) => string
): PacketSerialization {
  return (packet: UnserializedEncryptedPacket): SerializedEncryptedPacket => {
    if (!isValidUnserializedEncryptedPacket(packet)) {
      throw new Error('Cannot serialize data of an invalid packet')
    }
    let data: string
    try {
      data = uint8ArrayToBase64(packet.data)
    } catch (e) {
      throw new Error(`Cannot serialize packet encrypted data. ${(<Error>e)?.message}`)
    }
    return freeze({ ...packet, data })
  }
}
