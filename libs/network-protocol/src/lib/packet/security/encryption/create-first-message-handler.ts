/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SerializedData } from '../../../data/model'
import type { FirstMessageHandler } from '../../../security/model'
import type { UnencryptedPacket, UnserializedEncryptedPacket } from '../../model'
import { stringify, parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { deserializeData } from '../../../data/model'

/**
 * Creates a first message handler for dynamic key exchange protocols.
 *
 * When sending/receiving the first message (before key exchange), encryption
 * is skipped. This handler serializes the data to JSON and encodes it as binary
 * for the sender, and reverses the process for the receiver.
 *
 * @param textEncoder - Function to encode a string to Uint8Array
 * @param textDecoder - Function to decode Uint8Array to string
 * @returns FirstMessageHandler for handling unencrypted first messages
 *
 * @example
 * ```typescript
 * const handler = createFirstMessageHandler(
 *   (text) => new TextEncoder().encode(text),
 *   (data) => new TextDecoder().decode(data)
 * )
 * const serialized = await handler.serializeWithoutEncryption(packet)
 * ```
 */
export function createFirstMessageHandler<T = any>(
  textEncoder: (text: string) => Uint8Array,
  textDecoder: (data: Uint8Array) => string
): FirstMessageHandler<T> {
  const serializeWithoutEncryption = async (packet: UnencryptedPacket<T>): Promise<UnserializedEncryptedPacket> => {
    const serializedData: SerializedData<T> = {
      ...packet.data,
      message: <SerializedData<T>['message']>stringify(packet.data.message),
    }
    const jsonString = stringify(serializedData)
    const binaryData = textEncoder(jsonString)

    return freeze({
      origin: packet.origin,
      target: packet.target,
      data: binaryData,
    })
  }

  const deserializeWithoutDecryption = async (packet: UnserializedEncryptedPacket): Promise<UnencryptedPacket<T>> => {
    const jsonString = textDecoder(packet.data)
    const serializedData: SerializedData<T> = parse(jsonString)

    const data = deserializeData(serializedData)

    return freeze({
      origin: packet.origin,
      target: packet.target,
      data,
    })
  }

  return freeze({
    serializeWithoutEncryption,
    deserializeWithoutDecryption,
  })
}
