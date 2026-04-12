import type { ReceiverFactory } from '../../receiver/model'
import type { SenderFactory } from '../../sender/model'
import type { ChannelCreater, Channel } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { withoutValidErrorMessage } from '../utils/without-valid-err-msg'
import { getFirstInvalidProtocolProperty } from '../validations/get-first-invalid-protocol-property'
import { isValidLabel } from '../validations/is-valid-label'
import { isValidReceiver } from '../validations/is-valid-receiver'
import { isValidSender } from '../validations/is-valid-sender'

/**
 * Creates a channel creator factory with injected sender and receiver factories.
 *
 * @param createSender - Factory function to create senders
 * @param createReceiver - Factory function to create receivers
 * @returns A channel creator function
 *
 * @example Creating a channel with send capability
 * ```typescript
 * const createChannel = createChannelFactory(senderFactory, receiverFactory)
 * const channel = createChannel('comms', sendFn, receiveFn, protocolProvider)
 * channel.send(message)
 * ```
 */
export function createChannelFactory(createSender: SenderFactory, createReceiver: ReceiverFactory): ChannelCreater {
  return (label, sendPacket, receivePacket, protocolProvider) => {
    if (!isValidLabel(label)) {
      throw createError(withoutValidErrorMessage('label'))
    }
    if (!isValidSender(sendPacket)) {
      throw createError(withoutValidErrorMessage('send function'))
    }
    if (!isValidReceiver(receivePacket)) {
      throw createError(withoutValidErrorMessage('receive function'))
    }
    if (getType(protocolProvider) !== 'function') {
      throw createError(withoutValidErrorMessage('protocol provider function'))
    }
    const protocol = protocolProvider(sendPacket, receivePacket)
    const propName = getFirstInvalidProtocolProperty(protocol)
    if (propName) {
      throw createError(withoutValidErrorMessage(`${propName} function`))
    }
    const { send, receive, getLogger, packetEncryption, packetDecryption, packetObfuscation, packetDeobfuscation } = protocol
    const logger = getLogger()
    const sender = createSender(`${label} sender`, send, logger, packetEncryption, packetObfuscation)
    const receiver = createReceiver(`${label} receiver`, receive, logger, packetDeobfuscation, packetDecryption)
    const outbound: Channel['outbound'] = freeze({
      encryptionQueue: sender.encryptionQueue,
      serializationQueue: sender.serializationQueue,
      obfuscationQueue: sender.obfuscationQueue,
      stop: sender.stop,
      resume: sender.resume,
    })
    const inbound: Channel['inbound'] = freeze({
      deobfuscationQueue: receiver.deobfuscationQueue,
      deserializationQueue: receiver.deserializationQueue,
      decryptionQueue: receiver.decryptionQueue,
      stop: receiver.stop,
      resume: receiver.resume,
    })
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
      stop,
      resume,
      outbound,
      inbound,
    })
    return channel
  }
}
