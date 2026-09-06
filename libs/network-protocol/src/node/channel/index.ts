/**
 * Node.js-side channel management for secure bidirectional communication.
 *
 * @module @hyperfrontend/network-protocol/node/channel
 */
import { createChannelFactory } from '../../lib/channel/creators/create-channel'
import { createChannelStoreFactory } from '../../lib/channel/creators/create-channel-store'
import { createReceiver } from '../receiver'
import { createSender } from '../sender'

export const createChannel = createChannelFactory(createSender, createReceiver)
export const createChannelStore = createChannelStoreFactory(createChannel)
export type {
  HelloExchange,
  Protocol,
  ProtocolProvider,
  StopResumeControl,
  OutboundPipeline,
  InboundPipeline,
  Channel,
  ChannelOptions,
  ChannelCreater,
  ChannelEntry,
  ChannelStore,
} from '../../lib/channel/model'
export type { PacketDrop, PacketDropHandler, PacketDropStage } from '../../lib/packet/model'
export type { HelloOutcome, ProtocolSession, SessionRole } from '../../lib/security/model'
export { getFirstInvalidProtocolProperty } from '../../lib/channel/validations/get-first-invalid-protocol-property'
export { isValidChannel } from '../../lib/channel/validations/is-valid-channel'
export { isValidLabel } from '../../lib/channel/validations/is-valid-label'
export { isValidReceiver } from '../../lib/channel/validations/is-valid-receiver'
export { isValidSender } from '../../lib/channel/validations/is-valid-sender'
export { isValidSession } from '../../lib/channel/validations/is-valid-session'
