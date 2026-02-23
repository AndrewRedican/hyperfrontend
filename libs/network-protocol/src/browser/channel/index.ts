import { createChannelFactory } from '../../lib/channel/creators/create-channel'
import { createChannelStoreFactory } from '../../lib/channel/creators/create-channel-store'
import { createSender } from '../sender'
import { createReceiver } from '../receiver'

export const createChannel = createChannelFactory(createSender, createReceiver)
export const createChannelStore = createChannelStoreFactory(createChannel)

export type * from '../../lib/channel/model'
export * from '../../lib/channel/validations/validations'
