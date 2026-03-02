/* istanbul ignore file */

import type { Channel, MessagePayload, MessageCallback, Client, SendPacketFn, ReceivePacketFn, ReceivedPacket } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { createData } from '../../browser/data'
import { deserializeData } from '../../lib/data/model'
import { initChannel } from './init-channel'

/**
 * Creates a test client for network protocol V1 integration testing.
 *
 * @param label - Human-readable label for the client
 * @returns Client instance with connection and messaging capabilities
 */
export function createClient<T = MessagePayload>(label: string): Client<T> {
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

  // Initialize the channel
  channel = initChannel(label, sendPacket, receivePacket)

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
        throw createError(`Client "${label}" is not connected to any peer`)
      }
      if (!channel) {
        throw createError(`Client "${label}" channel is not initialized`)
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
        throw createError(`Client "${label}" channel is not initialized`)
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
