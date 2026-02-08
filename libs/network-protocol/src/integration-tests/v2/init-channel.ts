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
import { createProtocol } from '../../browser/v2'

/** Pre-shared key for V2 integration tests */
export const INTEGRATION_TEST_PSK = 'integration-test-shared-secret-key-2024'

/**
 * Creates a channel for integration testing using the production V2 protocol.
 *
 * The V2 protocol handles:
 * - **First message**: Encrypted with PSK + time-based obfuscation (handshake)
 * - **Subsequent messages**: Encrypted with dynamic key + time-based obfuscation
 *
 * @param label - Human-readable label for the channel
 * @param sendPacket - Callback to send packets
 * @param receivePacket - Callback to receive packets
 * @param sharedKey - Pre-shared key for handshake encryption (defaults to test key)
 * @returns Channel instance
 */
export function initChannel(
  label: string,
  sendPacket: SendPacketFn,
  receivePacket: ReceivePacketFn,
  sharedKey: string = INTEGRATION_TEST_PSK
): Channel {
  const serializePacket = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
  const deserializePacket = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
  const createSender = createSenderFactory(serializePacket)
  const createReceiver = createReceiverFactory(deserializePacket)
  const channelFactory = createChannelFactory(createSender, createReceiver)

  // Use production V2 protocol with pre-shared key
  const protocolProvider = createProtocol(logger, sharedKey, 1)

  return channelFactory(label, sendPacket, receivePacket, protocolProvider)
}
