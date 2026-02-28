/* istanbul ignore file */

import type { Channel, MessagePayload, MessageCallback, Client, SendPacketFn, ReceivePacketFn, ReceivedPacket } from '../model'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { createData } from '../../browser/data'
import { deserializeData } from '../../lib/data/model'
import { initChannel, INTEGRATION_TEST_PSK } from './init-channel'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Creates a test client for network protocol V2 integration testing.
 *
 * V2 uses pre-shared key (PSK) encryption for the initial handshake,
 * then switches to dynamic keys for subsequent messages. Both parties
 * must share the same secret key beforehand.
 *
 * @param label - Human-readable label for the client
 * @param sharedKey - Pre-shared key for handshake encryption (defaults to test key)
 * @returns Client instance with connection and messaging capabilities
 */
export function createClient<T = MessagePayload>(label: string, sharedKey: string = INTEGRATION_TEST_PSK): Client<T> {
  const clientId = uuidV4()
  const listeners: MessageCallback<T>[] = []
  let connectedPeer: Client<T> | null = null
  let channel: Channel | null = null
  let sequenceCounter = 0

  // sendPacket: Transmits the encrypted/obfuscated packet to the peer
  const sendPacket: SendPacketFn = (packet) => {
    if (connectedPeer) {
      // Simulate network delivery by calling peer's receive method
      connectedPeer._deliverPacket(packet)
    }
  }

  // receivePacket: Called when channel completes decryption/deobfuscation
  // The packet.data is a Data<T> structure with message field containing the actual T
  const receivePacket: ReceivePacketFn = (packet) => {
    // Cast to the expected structure and notify listeners
    const typedPacket = <ReceivedPacket<T>>packet
    listeners.forEach((callback) => callback(typedPacket))
  }

  // Initialize the channel with the shared key
  channel = initChannel(label, sendPacket, receivePacket, sharedKey)

  const client: Client<T> = {
    id: clientId,
    label,

    _deliverPacket: (packet: Uint8Array) => {
      if (channel) {
        channel.receive(packet)
      }
    },

    isConnected(): boolean {
      return connectedPeer !== null
    },

    connect(target: Client<T>): Client<T> {
      connectedPeer = target
      // Establish bidirectional connection only if target isn't already connected
      if (!target.isConnected()) {
        target.connect(this)
      }
      return this
    },

    async send(message: T): Promise<Client<T>> {
      if (!connectedPeer) {
        throw new Error(`Client "${label}" is not connected to any peer`)
      }
      if (!channel) {
        throw new Error(`Client "${label}" channel is not initialized`)
      }

      sequenceCounter++
      const pid = uuidV4()
      const serializedData = await createData<T>(pid, sequenceCounter, message)

      // Deserialize the data (parse the message from JSON string to object)
      // The channel expects Data<T> (deserialized), not SerializedData<T>
      const data = deserializeData(serializedData)

      // Send the data through the channel
      channel.send(clientId, connectedPeer.id, data)

      return this
    },

    onMessage(callback: MessageCallback<T>): Client<T> {
      listeners.push(callback)
      return this
    },

    getChannel(): Channel {
      if (!channel) {
        throw new Error(`Client "${label}" channel is not initialized`)
      }
      return channel
    },

    disconnect(): void {
      if (channel) {
        channel.stop()
      }
      connectedPeer = null
    },
  }

  return freeze(client)
}
