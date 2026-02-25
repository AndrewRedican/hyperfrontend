import type { ChannelCreater, Channel } from '../model'
import type { SenderFactory } from '../../sender/model'
import type { ReceiverFactory } from '../../receiver/model'
import { isValidLabel } from '../validations/is-valid-label'
import { isValidSender } from '../validations/is-valid-sender'
import { isValidReceiver } from '../validations/is-valid-receiver'
import { getFirstInvalidProtocolProperty } from '../validations/get-first-invalid-protocol-property'
import { withoutValidErrorMessage } from '../utils/without-valid-err-msg'
import { getType } from '@hyperfrontend/data-utils'

/**
 * Creates a channel creator factory with injected sender and receiver factories.
 *
 * @param createSender - Factory function to create senders
 * @param createReceiver - Factory function to create receivers
 * @returns A channel creator function
 */
export function createChannelFactory(createSender: SenderFactory, createReceiver: ReceiverFactory): ChannelCreater {
  return (label, sendPacket, receivePacket, protocolProvider) => {
    if (!isValidLabel(label)) {
      throw new Error(withoutValidErrorMessage('label'))
    }
    if (!isValidSender(sendPacket)) {
      throw new Error(withoutValidErrorMessage('send function'))
    }
    if (!isValidReceiver(receivePacket)) {
      throw new Error(withoutValidErrorMessage('receive function'))
    }
    if (getType(protocolProvider) !== 'function') {
      throw new Error(withoutValidErrorMessage('protocol provider function'))
    }
    const protocol = protocolProvider(sendPacket, receivePacket)
    const propName = getFirstInvalidProtocolProperty(protocol)
    if (propName) {
      throw new Error(withoutValidErrorMessage(`${propName} function`))
    }
    const { send, receive, getLogger, packetEncryption, packetDecryption, packetObfuscation, packetDeobfuscation } = protocol
    const logger = getLogger()
    const sender = createSender(`${label} sender`, send, logger, packetEncryption, packetObfuscation)
    const receiver = createReceiver(`${label} receiver`, receive, logger, packetDeobfuscation, packetDecryption)
    const outbound: Channel['outbound'] = Object.freeze({
      encryptionQueue: sender.encryptionQueue,
      serializationQueue: sender.serializationQueue,
      obfuscationQueue: sender.obfuscationQueue,
      stop: sender.stop,
      resume: sender.resume,
    })
    const inbound: Channel['inbound'] = Object.freeze({
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
    const channel: Channel = Object.freeze({
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
