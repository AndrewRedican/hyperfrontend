/**
 * Node.js-side inbound pipeline: frames in, opened packets out.
 *
 * @module @hyperfrontend/network-protocol/node/receiver
 */
export type { ReceivePacketFn, ReceiveFn, InboundQueue, Receiver, CreateReceiver, ReceiverFactory } from '../../lib/receiver/model'
export { createReceiver } from '../../lib/receiver/creators/create-receiver'
