import type { ReceiverFactory } from '../../receiver/model'
import type { SenderFactory } from '../../sender/model'
import type { ChannelCreater, Channel, InboundPipeline, OutboundPipeline } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { withoutValidErrorMessage } from '../utils/without-valid-err-msg'
import { getFirstInvalidProtocolProperty } from '../validations/get-first-invalid-protocol-property'
import { isValidLabel } from '../validations/is-valid-label'
import { isValidReceiver } from '../validations/is-valid-receiver'
import { isValidSender } from '../validations/is-valid-sender'
import { isValidSession } from '../validations/is-valid-session'

/**
 * Creates a channel creator with injected sender and receiver factories.
 *
 * A channel binds one protocol instance to one session: the provider is called once with
 * the transport callbacks and the session, the resulting seal and open operations feed the
 * outbound and inbound pipelines, and the protocol's hello exchange is exposed unchanged so
 * the owner can run it over the same transport. A provider that throws (a session it cannot
 * key) throws out of `createChannel` in the caller's frame.
 *
 * @param createSender - Factory function to create senders
 * @param createReceiver - Factory function to create receivers
 * @returns A channel creator function
 *
 * @example Creating a channel for a negotiated session
 * ```typescript
 * const createChannel = createChannelFactory(createSender, createReceiver)
 * const channel = createChannel('comms', { send: sendFn, receive: receiveFn, protocolProvider: suite.protocolProvider, session, onDrop: (drop) => report(drop) })
 * channel.send(originId, targetId, data)
 * ```
 */
export function createChannelFactory(createSender: SenderFactory, createReceiver: ReceiverFactory): ChannelCreater {
  return (label, options) => {
    if (!isValidLabel(label)) {
      throw createError(withoutValidErrorMessage('label'))
    }
    if (getType(options) !== 'object') {
      throw createError(withoutValidErrorMessage('options object'))
    }
    const { send: sendPacket, receive: receivePacket, protocolProvider, session, onDrop } = options
    if (!isValidSender(sendPacket)) {
      throw createError(withoutValidErrorMessage('send function'))
    }
    if (!isValidReceiver(receivePacket)) {
      throw createError(withoutValidErrorMessage('receive function'))
    }
    if (getType(protocolProvider) !== 'function') {
      throw createError(withoutValidErrorMessage('protocol provider function'))
    }
    if (!isValidSession(session)) {
      throw createError(withoutValidErrorMessage('session'))
    }
    const protocol = protocolProvider(sendPacket, receivePacket, session)
    const propName = getFirstInvalidProtocolProperty(protocol)
    if (propName) {
      throw createError(withoutValidErrorMessage(`${propName} function`))
    }
    const { send, receive, getLogger, seal, open, hello, isHello, acceptHello } = protocol
    const logger = getLogger()
    const sender = createSender(`${label} sender`, send, logger, seal, onDrop)
    const receiver = createReceiver(`${label} receiver`, receive, logger, open, onDrop)
    const outbound: OutboundPipeline = freeze({ queue: sender.queue, stop: sender.stop, resume: sender.resume })
    const inbound: InboundPipeline = freeze({ queue: receiver.queue, stop: receiver.stop, resume: receiver.resume })
    const stop = () => {
      inbound.stop()
      outbound.stop()
    }
    const resume = () => {
      inbound.resume()
      outbound.resume()
    }
    const channel: Channel = freeze({
      label,
      send: sender.send,
      receive: receiver.receive,
      hello,
      isHello,
      acceptHello,
      stop,
      resume,
      outbound,
      inbound,
    })
    return channel
  }
}
