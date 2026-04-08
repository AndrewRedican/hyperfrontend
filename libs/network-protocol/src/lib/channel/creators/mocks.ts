import type { ReceiverFactory } from '../../receiver/model'
import type { SenderFactory } from '../../sender/model'
import type { Channel } from '../model'
import { createSerializedEncryptedPacket, createDeserializedEncryptedPacket } from '../../packet/creators/mocks'
import { createReceiverFactory } from '../../receiver/creators/create-receiver-factory'
import { createSenderFactory } from '../../sender/creators/create-sender-factory'
import { createChannelFactory } from './create-channel'
import { createChannelStoreFactory } from './create-channel-store'

/** Mock sender factory for testing */
export const mockCreateSender: SenderFactory = createSenderFactory(createSerializedEncryptedPacket)
/** Mock receiver factory for testing */
export const mockCreateReceiver: ReceiverFactory = createReceiverFactory(createDeserializedEncryptedPacket)
/** Mock channel factory for testing */
export const mockCreateChannel = createChannelFactory(mockCreateSender, mockCreateReceiver)
/** Mock channel store factory for testing */
export const mockCreateChannelStore = createChannelStoreFactory(mockCreateChannel)

/** Mock channel label */
export const label = 'channel-label'

/**
 * Mock stop function.
 *
 * @returns void
 */
export const stop = () => void 0

/**
 * Mock resume function.
 *
 * @returns void
 */
export const resume = () => void 0

/**
 * Mock send function.
 *
 * @returns void
 */
export const send = () => void 0

/**
 * Mock receive function.
 *
 * @returns void
 */
export const receive = () => void 0

export const queue = { size: 10 }

export const channel: Channel = {
  label,
  send,
  receive,
  outbound: {
    encryptionQueue: { ...queue },
    serializationQueue: { ...queue },
    obfuscationQueue: { ...queue },
    stop,
    resume,
  },
  inbound: {
    deobfuscationQueue: { ...queue },
    deserializationQueue: { ...queue },
    decryptionQueue: { ...queue },
    stop,
    resume,
  },
  stop,
  resume,
}
