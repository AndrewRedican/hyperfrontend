import type { PacketSerialization } from '../../packet/model'
import type { CreateSender, Sender, SendFn, OutboundQueue } from '../model'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createUnencryptedPacket } from '../../packet/creators/create-unencrypted-packet'
import { createObfuscationQueue, createSerializationQueue, createEncryptionQueue } from '../../queue'

/**
 * Creates a sender factory with the provided packet serialization implementation.
 *
 * @param createSerializedEncryptedPacket - Function that serializes encrypted packets
 * @returns A CreateSender function that creates sender instances
 *
 * @example Creating a sender factory
 * ```typescript
 * import { createSerializedEncryptedPacketCreator } from '@hyperfrontend/network-protocol/lib/packet/creators/create-serialized-encrypted-packet-creator'
 * import { uint8ArrayToBase64 } from '@hyperfrontend/string-utils/browser'
 * import { createSenderFactory } from '@hyperfrontend/network-protocol/lib/sender/creators/create-sender-factory'
 *
 * const serializePacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
 * const createSender = createSenderFactory(serializePacket)
 * const sender = createSender(label, sendPacket, logger, packetEncryption, packetObfuscation)
 * ```
 */
export function createSenderFactory(createSerializedEncryptedPacket: PacketSerialization): CreateSender {
  return (label, sendPacket, logger, packetEncryption, packetObfuscation): Sender => {
    const noop = () => void 0
    const obfuscation = createObfuscationQueue(label, packetObfuscation, logger, sendPacket, noop)
    const serialization = createSerializationQueue(label, createSerializedEncryptedPacket, logger, obfuscation.addMessage, noop)
    const encryption = createEncryptionQueue(label, packetEncryption, logger, serialization.addMessage, noop)
    const send: SendFn = (origin, target, data) => encryption.addMessage(createUnencryptedPacket(origin, target, data))
    const stop = () => {
      encryption.stop()
      serialization.stop()
      obfuscation.stop()
    }
    const resume = () => {
      obfuscation.resume()
      serialization.resume()
      encryption.resume()
    }
    const encryptionQueue: OutboundQueue = freeze({
      get size() {
        return encryption.size()
      },
    })
    const serializationQueue: OutboundQueue = freeze({
      get size() {
        return serialization.size()
      },
    })
    const obfuscationQueue: OutboundQueue = freeze({
      get size() {
        return obfuscation.size()
      },
    })
    const sender: Sender = freeze({
      send,
      stop,
      resume,
      encryptionQueue,
      serializationQueue,
      obfuscationQueue,
    })
    return sender
  }
}
