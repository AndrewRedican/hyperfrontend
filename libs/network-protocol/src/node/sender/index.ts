import { createSenderFactory } from '../../lib/sender/creators/create-sender-factory'
import { createSerializedEncryptedPacket } from '../packet'

export const createSender = createSenderFactory(createSerializedEncryptedPacket)

export type * from '../../lib/sender/model'
