/* istanbul ignore file */

import type { Channel, MessagePayload, MessageCallback, Client, SendPacketFn, ReceivePacketFn, ReceivedPacket } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { createData } from '../../browser/data'
import { deserializeData } from '../../lib/data/model'
import { initChannel, INTEGRATION_TEST_PSK } from './init-channel'

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
 *
 * @example Creating connected V2 test clients with PSK
 * ```typescript
 * const alice = createClient('alice', 'secret-psk')
 * const bob = createClient('bob', 'secret-psk')
 * alice.connect(bob)
 * await alice.send({ type: 'secure-message', data: 'encrypted' })
 * ```
 */
export function createClient<T = MessagePayload>(label: string, sharedKey: string = INTEGRATION_TEST_PSK): Client<T> {
  const clientId = uuidV4()
  const listeners: MessageCallback<T>[] = []
  let connectedPeer: Client<T> | null = null
  let channel: Channel | null = null
  let sequenceCounter = 0

  const sendPacket: SendPacketFn = (packet) => {
    if (connectedPeer) {
      connectedPeer._deliverPacket(packet)
    }
  }

  const receivePacket: ReceivePacketFn = (packet) => {
    const typedPacket = <ReceivedPacket<T>>packet
    listeners.forEach((callback) => callback(typedPacket))
  }

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

      const data = deserializeData(serializedData)

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
