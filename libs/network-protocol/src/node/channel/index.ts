import { createChannelFactory } from '../../lib/channel/creators/create-channel'
import { createChannelStoreFactory } from '../../lib/channel/creators/create-channel-store'
import { createReceiver } from '../receiver'
import { createSender } from '../sender'

export const createChannel = createChannelFactory(createSender, createReceiver)
export const createChannelStore = createChannelStoreFactory(createChannel)

export type * from '../../lib/channel/model'
export * from '../../lib/channel/validations/get-first-invalid-protocol-property'
export * from '../../lib/channel/validations/is-valid-channel'
export * from '../../lib/channel/validations/is-valid-label'
export * from '../../lib/channel/validations/is-valid-receiver'
export * from '../../lib/channel/validations/is-valid-sender'
