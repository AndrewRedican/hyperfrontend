import type { PacketDeserialization } from '../../packet/model'
import type { CreateReceiver, Receiver, ReceiveFn, InboundQueue } from '../model'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createDecryptionQueue, createDeobfuscationQueue, createDeserializationQueue } from '../../queue'

/**
 * Creates a receiver factory with the provided packet deserialization implementation.
 *
 * @param createDeserializedEncryptedPacket - Function that deserializes encrypted packets
 * @returns A CreateReceiver function that creates receiver instances
 *
 * @example Creating a receiver factory
 * ```typescript
 * import { createDeserializedEncryptedPacketCreator } from '@hyperfrontend/network-protocol/lib/packet/creators/create-deserialized-encrypted-packet-creator'
 * import { base64ToUint8Array } from '@hyperfrontend/string-utils/browser'
 * import { createReceiverFactory } from '@hyperfrontend/network-protocol/lib/receiver/creators/create-receiver-factory'
 *
 * const deserializePacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
 * const createReceiver = createReceiverFactory(deserializePacket)
 * const receiver = createReceiver(label, receivePacket, logger, packetDeobfuscation, packetDecryption)
 * ```
 */
export function createReceiverFactory(createDeserializedEncryptedPacket: PacketDeserialization): CreateReceiver {
  return (label, receivePacket, logger, packetDeobfuscation, packetDecryption): Receiver => {
    const noop = () => void 0
    const decryption = createDecryptionQueue(label, packetDecryption, logger, receivePacket, noop)
    const deserialization = createDeserializationQueue(label, createDeserializedEncryptedPacket, logger, decryption.addMessage, noop)
    const deobfuscation = createDeobfuscationQueue(label, packetDeobfuscation, logger, deserialization.addMessage, noop)
    const receive: ReceiveFn = (packet) => deobfuscation.addMessage(packet)
    const stop = () => {
      deobfuscation.stop()
      deserialization.stop()
      decryption.stop()
    }
    const resume = () => {
      decryption.resume()
      deserialization.resume()
      deobfuscation.resume()
    }
    const deobfuscationQueue: InboundQueue = freeze({
      get size() {
        return deobfuscation.size()
      },
    })
    const deserializationQueue: InboundQueue = freeze({
      get size() {
        return deserialization.size()
      },
    })
    const decryptionQueue: InboundQueue = freeze({
      get size() {
        return decryption.size()
      },
    })
    const receiver: Receiver = freeze({
      receive,
      stop,
      resume,
      deobfuscationQueue,
      deserializationQueue,
      decryptionQueue,
    })
    return receiver
  }
}
