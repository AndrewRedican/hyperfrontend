import { createSerializedEncryptedPacket } from '../packet'
import { createSenderFactory } from '../../lib/sender/creators/create-sender-factory'

export const createSender = createSenderFactory(createSerializedEncryptedPacket)

export type * from '../../lib/sender/model'
