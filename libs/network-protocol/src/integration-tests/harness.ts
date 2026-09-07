import type { Channel, ProtocolProvider } from '../lib/channel/model'
import type { Data } from '../lib/data/model'
import type { PacketDrop } from '../lib/packet/model'
import type { SessionRole } from '../lib/security/model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createPromise, promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { createChannel } from '../browser/channel'
import { createData } from '../browser/data'
import { deserializeData } from '../lib/data/model'

/** One party in a two-party in-memory session */
export interface Party {
  /** The party's identity as stamped on packets */
  readonly id: string
  /** The channel bound to the negotiated session */
  readonly channel: Channel
  /** Every packet the party delivered */
  readonly received: Data[]
  /** Every sealed frame the party posted */
  readonly frames: Uint8Array[]
  /** Every drop the party's pipeline reported */
  readonly drops: PacketDrop[]
  /**
   * Sends a message to the peer.
   *
   * @param message - The message payload
   */
  send(message: unknown): Promise<void>
}

/** Both parties of one session */
export interface Pair {
  /** The side that initiated */
  readonly initiator: Party
  /** The side that answered */
  readonly responder: Party
}

/** The two channels of a pair, filled in once both exist */
interface Wire {
  /** The initiator's channel */
  initiator?: Channel
  /** The responder's channel */
  responder?: Channel
}

/**
 * Wires two channels together in memory and runs their hello exchange, so each party's
 * `send` posts straight into the other's pipeline. Hello frames go to `acceptHello`; sealed
 * frames go to `receive`, exactly as a transport would route them.
 *
 * @param protocol - The negotiated protocol id
 * @param initiatorProvider - The initiator's provider (any platform)
 * @param responderProvider - The responder's provider (any platform)
 * @returns The connected pair
 *
 * @example Connecting two v3 sides
 * ```typescript
 * const { initiator, responder } = await connectPair('v3', createProtocol(logger), createProtocol(logger))
 * await initiator.send({ type: 'PING' })
 * ```
 */
export async function connectPair(
  protocol: string,
  initiatorProvider: ProtocolProvider,
  responderProvider: ProtocolProvider
): Promise<Pair> {
  const initiatorId = uuidV4()
  const responderId = uuidV4()
  const wire: Wire = {}
  let sequence = 0

  const party = (
    id: string,
    peerId: string,
    role: SessionRole,
    protocolProvider: ProtocolProvider,
    peer: () => Channel | undefined
  ): Party => {
    const received: Data[] = []
    const frames: Uint8Array[] = []
    const drops: PacketDrop[] = []
    const channel = createChannel(role, {
      send: (frame) => {
        frames.push(frame)
        peer()?.receive(frame)
      },
      receive: (packet) => received.push(packet.data),
      protocolProvider,
      session: { protocol, role, localId: id, peerId },
      onDrop: (drop) => drops.push(drop),
    })
    return {
      id,
      channel,
      received,
      frames,
      drops,
      send: async (message) => {
        sequence += 1
        channel.send(id, peerId, deserializeData(await createData(uuidV4(), sequence, message)))
      },
    }
  }

  const initiator = party(initiatorId, responderId, 'initiator', initiatorProvider, () => wire.responder)
  const responder = party(responderId, initiatorId, 'responder', responderProvider, () => wire.initiator)
  wire.initiator = initiator.channel
  wire.responder = responder.channel
  const [initiatorHello, responderHello] = await promiseAll([initiator.channel.hello(), responder.channel.hello()])
  responder.channel.acceptHello(initiatorHello)
  initiator.channel.acceptHello(responderHello)
  return { initiator, responder }
}

/**
 * Polls until a condition holds.
 *
 * @param condition - The condition to wait for
 * @param attempts - How many 25 ms polls to allow
 *
 * @example Waiting for delivery
 * ```typescript
 * await waitFor(() => responder.received.length === 1)
 * ```
 */
export async function waitFor(condition: () => boolean, attempts = 200): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (condition()) {
      return
    }
    await createPromise((resolve) => setTimeout(resolve, 25))
  }
  throw createError('Timed out waiting for condition')
}
