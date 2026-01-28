import type { Channel } from '../model'
import type { SenderFactory } from '../../sender/model'
import type { ReceiverFactory } from '../../receiver/model'
import { createSenderFactory } from '../../sender/creators/create-sender-factory'
import { createReceiverFactory } from '../../receiver/creators/create-receiver-factory'
import { createChannelFactory } from './create-channel'
import { createChannelStoreFactory } from './create-channel-store'
import { createSerializedEncryptedPacket, createDeserializedEncryptedPacket } from '../../packet/creators/mocks'

export const mockCreateSender: SenderFactory = createSenderFactory(createSerializedEncryptedPacket)
export const mockCreateReceiver: ReceiverFactory = createReceiverFactory(createDeserializedEncryptedPacket)
export const mockCreateChannel = createChannelFactory(mockCreateSender, mockCreateReceiver)
export const mockCreateChannelStore = createChannelStoreFactory(mockCreateChannel)

export const label = 'channel-label'

export const stop = () => void 0

export const resume = () => void 0

export const send = () => void 0

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
