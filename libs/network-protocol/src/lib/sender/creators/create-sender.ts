import type { CreateSender, Sender, SendFn, OutboundQueue } from '../model'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createUnencryptedPacket } from '../../packet/creators/create-unencrypted-packet'
import { createSealQueue } from '../../queue/creators/create-seal-queue'

/**
 * Creates the outbound half of a channel: packets are assembled, sealed one at a time on the
 * session's sending key, and handed to the transport as wire bytes.
 *
 * `send` validates the origin, target, and data envelope synchronously and throws in the
 * caller's frame on a malformed packet; everything after that is asynchronous, and a packet
 * the sealer rejects is reported through `onDrop` rather than thrown.
 *
 * @param label - Identifier for the sender used in logging
 * @param sendPacket - Transmits each sealed frame
 * @param logger - Logger instance for debug and error messages
 * @param seal - The session's sealer
 * @param onDrop - Optional; receives each packet the sealer rejects
 * @returns A sender with `send`, `stop`, `resume`, and its queue
 *
 * @example Creating a sender over a postMessage transport
 * ```typescript
 * const sender = createSender('host sender', (frame) => frameWindow.postMessage(frame, origin, [frame.buffer]), logger, protocol.seal, (drop) => report(drop))
 * sender.send(originId, targetId, data)
 * ```
 */
export const createSender: CreateSender = (label, sendPacket, logger, seal, onDrop): Sender => {
  // why: The seal stage already logs its own failure; the drop handler exists so the owner of the pipeline can surface a message that never left.
  const drop = (packet: unknown, reason: string, cause?: unknown) =>
    onDrop?.({ direction: 'outbound', stage: 'seal', reason, cause, packet })
  const sealing = createSealQueue(label, seal, logger, sendPacket, drop)
  const send: SendFn = (origin, target, data) => sealing.addMessage(createUnencryptedPacket(origin, target, data))
  const queue: OutboundQueue = freeze({
    get size() {
      return sealing.size()
    },
  })
  return freeze({ send, stop: sealing.stop, resume: sealing.resume, queue })
}
