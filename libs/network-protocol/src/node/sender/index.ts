/**
 * Node.js-side outbound pipeline: packets in, sealed frames out.
 *
 * @module @hyperfrontend/network-protocol/node/sender
 */
export type { SendPacketFn, SendFn, OutboundQueue, Sender, CreateSender, SenderFactory } from '../../lib/sender/model'
export { createSender } from '../../lib/sender/creators/create-sender'
