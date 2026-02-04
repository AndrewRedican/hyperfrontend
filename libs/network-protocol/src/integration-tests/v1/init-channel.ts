/* istanbul ignore file */
import type { Channel } from '../../lib/channel/model'
import type { SendPacketFn } from '../../lib/sender/model'
import type { ReceivePacketFn } from '../../lib/receiver/model'
import { uint8ArrayToBase64, base64ToUint8Array } from '@hyperfrontend/string-utils/browser'
import { logger } from '@hyperfrontend/logging'
import { createSenderFactory } from '../../lib/sender/creators/create-sender-factory'
import { createReceiverFactory } from '../../lib/receiver/creators/create-receiver-factory'
import { createSerializedEncryptedPacketCreator } from '../../lib/packet/creators/create-serialized-encrypted-packet-creator'
import { createDeserializedEncryptedPacketCreator } from '../../lib/packet/creators/create-deserialized-encrypted-packet-creator'
import { createChannelFactory } from '../../lib/channel/creators/create-channel'
import { createProtocol } from '../../browser/v1'

/**
 * Creates a channel for integration testing using the production V1 protocol.
 *
 * The V1 protocol handles:
 * - **First message**: Obfuscation only (no encryption), key extracted for future use
 * - **Subsequent messages**: Full encryption + obfuscation with dynamic keys
 *
 * @param label - Human-readable label for the channel
 * @param sendPacket - Callback to send packets
 * @param receivePacket - Callback to receive packets
 * @returns Channel instance
 */
export function initChannel(label: string, sendPacket: SendPacketFn, receivePacket: ReceivePacketFn): Channel {
  const serializePacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
  const deserializePacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
  const createSender = createSenderFactory(serializePacket)
  const createReceiver = createReceiverFactory(deserializePacket)
  const channelFactory = createChannelFactory(createSender, createReceiver)

  // Use production V1 protocol with dynamic key exchange
  const protocolProvider = createProtocol(logger, 1)

  return channelFactory(label, sendPacket, receivePacket, protocolProvider)
}
