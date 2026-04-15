/**
 * Browser-side inbound packet receiver with deserialization and decryption.
 *
 * @module @hyperfrontend/network-protocol/browser/receiver
 */
import { createReceiverFactory } from '../../lib/receiver/creators/create-receiver-factory'
import { createDeserializedEncryptedPacket } from '../packet'

export const createReceiver = createReceiverFactory(createDeserializedEncryptedPacket)
export type {
  ReceivePacketFn,
  ReceiveFn,
  InboundQueue,
  InboundQueues,
  Receiver,
  CreateReceiver,
  ReceiverFactory,
} from '../../lib/receiver/model'
