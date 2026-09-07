import type { CreateReceiver, Receiver, ReceiveFn, InboundQueue } from '../model'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createOpenQueue } from '../../queue/creators/create-open-queue'

/**
 * Creates the inbound half of a channel: frames are opened one at a time on the session's
 * receiving key and delivered as plaintext packets.
 *
 * A frame the opener rejects (forged, replayed, foreign, or malformed) is reported through
 * `onDrop` and never delivered.
 *
 * @param label - Identifier for the receiver used in logging
 * @param receivePacket - Receives each opened packet
 * @param logger - Logger instance for debug and error messages
 * @param open - The session's opener
 * @param onDrop - Optional; receives each frame the opener rejects
 * @returns A receiver with `receive`, `stop`, `resume`, and its queue
 *
 * @example Creating a receiver fed by a message listener
 * ```typescript
 * const receiver = createReceiver('host receiver', (packet) => deliver(packet.data.message), logger, protocol.open, (drop) => report(drop))
 * window.addEventListener('message', (event) => receiver.receive(event.data))
 * ```
 */
export const createReceiver: CreateReceiver = (label, receivePacket, logger, open, onDrop): Receiver => {
  // why: The open stage already logs its own failure; the drop handler exists so the owner of the pipeline can surface the loss to whoever sent the frame.
  const drop = (packet: unknown, reason: string, cause?: unknown) =>
    onDrop?.({ direction: 'inbound', stage: 'open', reason, cause, packet })
  const opening = createOpenQueue(label, open, logger, receivePacket, drop)
  const receive: ReceiveFn = (packet) => opening.addMessage(packet)
  const queue: InboundQueue = freeze({
    get size() {
      return opening.size()
    },
  })
  return freeze({ receive, stop: opening.stop, resume: opening.resume, queue })
}
