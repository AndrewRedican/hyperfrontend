import { createReceiverFactory } from '../../lib/receiver/creators/create-receiver-factory'
import { createDeserializedEncryptedPacket } from '../packet'

export const createReceiver = createReceiverFactory(createDeserializedEncryptedPacket)

export type * from '../../lib/receiver/model'
