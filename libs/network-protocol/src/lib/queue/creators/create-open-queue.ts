import type { UnencryptedPacket, WirePacket } from '../../packet/model'
import type { OpenQueueCreater } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isValidUnencryptedPacket } from '../../packet/validations/is-valid-unencrypted-packet'
import { isValidWirePacket } from '../../packet/validations/is-valid-wire-packet'
import { getValidationError } from '../utils/get-validation-error'
import { isValidQueueCreaterArguments } from '../validations/is-valid-queue-creater-arguments'
import { createQueue } from './create-queue'

/**
 * Creates the inbound queue: wire bytes in, plaintext packets out, one at a time.
 *
 * Bytes that are not a wire packet, an open that throws (a forged, replayed, or foreign
 * frame), or an open that yields an invalid packet are reported through `onFail` and the
 * queue moves on. Processing one frame at a time is what keeps a session's replay counter
 * exact.
 *
 * @param label - Identifier for the queue used in logging
 * @param open - The session's opener
 * @param logger - Logger instance for debug and error messages
 * @param onSuccess - Callback invoked with the opened plaintext packet
 * @param onFail - Callback invoked, with the reason and any thrown error, when a frame is rejected
 * @returns A queue instance for opening frames
 *
 * @example Creating an open queue
 * ```typescript
 * const queue = createOpenQueue('receiver', protocol.open, logger, (packet) => deliver(packet), (frame, reason, cause) => report(reason, cause))
 * ```
 */
export const createOpenQueue: OpenQueueCreater = (label, open, logger, onSuccess, onFail) => {
  const validity = isValidQueueCreaterArguments({ label, operation: open, logger, onSuccess, onFail })
  const errorMessage = getValidationError('open', validity)
  if (errorMessage) {
    throw createError(errorMessage)
  }
  const { debug, log, warn, error } = logger
  const process = async (raw: WirePacket): Promise<void> => {
    try {
      debug(`${label}: Check frame is valid`)
      if (!isValidWirePacket(raw)) {
        log(`${label}: Invalid frame ignored`)
        onFail(raw, 'Invalid frame ignored')
        return
      }
      debug(`${label}: Open frame`)
      let opened: UnencryptedPacket
      try {
        opened = await open(raw)
      } catch (e) {
        log(`${label}: ${(e as Error)?.message}`)
        onFail(raw, `${(e as Error)?.message}`, e)
        return
      }
      debug(`${label}: Check opened packet is valid`)
      if (!isValidUnencryptedPacket(opened)) {
        warn(`${label}: Opened packet is not valid`)
        onFail(raw, 'Opened packet is not valid')
        return
      }
      onSuccess(opened)
    } catch (e) {
      error(`An unexpected error occurred. ${e}`)
      onFail(raw, `An unexpected error occurred. ${e}`, e)
    }
  }
  return createQueue<WirePacket>(process)
}
