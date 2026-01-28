import { createDeserializedEncryptedPacket } from '../packet'
import { createReceiverFactory } from '../../lib/receiver/creators/create-receiver-factory'

export const createReceiver = createReceiverFactory(createDeserializedEncryptedPacket)

export type * from '../../lib/receiver/model'
