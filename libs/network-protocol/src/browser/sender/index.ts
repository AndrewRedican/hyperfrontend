/**
 * Browser-side outbound packet sender with serialization and encryption.
 *
 * @module @hyperfrontend/network-protocol/browser/sender
 */
import { createSenderFactory } from '../../lib/sender/creators/create-sender-factory'
import { createSerializedEncryptedPacket } from '../packet'

export const createSender = createSenderFactory(createSerializedEncryptedPacket)
export type { SendPacketFn, SendFn, OutboundQueue, OutboundQueues, Sender, CreateSender, SenderFactory } from '../../lib/sender/model'
