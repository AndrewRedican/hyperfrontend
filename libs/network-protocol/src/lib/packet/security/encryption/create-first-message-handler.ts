/* eslint-disable @typescript-eslint/no-explicit-any */
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { stringify, parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import type { FirstMessageHandler } from '../../../security/model'
import type { UnencryptedPacket, UnserializedEncryptedPacket } from '../../model'
import type { SerializedData } from '../../../data/model'
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
 */
export function createFirstMessageHandler<T = any>(
  textEncoder: (text: string) => Uint8Array,
  textDecoder: (data: Uint8Array) => string
): FirstMessageHandler<T> {
  const serializeWithoutEncryption = async (packet: UnencryptedPacket<T>): Promise<UnserializedEncryptedPacket> => {
    // Serialize the data to JSON string, then encode as binary
    // This maintains the same packet shape (data: Uint8Array) but without encryption
    const serializedData: SerializedData<T> = {
      ...packet.data,
      message: stringify(packet.data.message) as SerializedData<T>['message'],
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
    // Decode binary to JSON string, then parse
    const jsonString = textDecoder(packet.data)
    const serializedData: SerializedData<T> = parse(jsonString)

    // Deserialize the data (parse the message from JSON string to object)
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
