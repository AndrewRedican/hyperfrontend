import type { UnencryptedPacket, WirePacket } from '../../packet/model'
import type { QueueFailureHandler, SealQueueCreater } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isValidUnencryptedPacket } from '../../packet/validations/is-valid-unencrypted-packet'
import { isValidWirePacket } from '../../packet/validations/is-valid-wire-packet'
import { getValidationError } from '../utils/get-validation-error'
import { isValidQueueCreaterArguments } from '../validations/is-valid-queue-creater-arguments'
import { createQueue } from './create-queue'

/**
 * Creates the outbound queue: plaintext packets in, sealed wire bytes out, one at a time.
 *
 * A packet that is not a valid plaintext packet, a seal that throws, or a seal that yields
 * something other than wire bytes is reported through `onFail` and the queue moves on.
 *
 * @param label - Identifier for the queue used in logging
 * @param seal - The session's sealer
 * @param logger - Logger instance for debug and error messages
 * @param onSuccess - Callback invoked with the sealed wire bytes
 * @param onFail - Callback invoked, with the reason and any thrown error, when a packet is rejected; a throw from it is logged and does not stop the queue
 * @returns A queue instance for sealing packets
 *
 * @example Creating a seal queue
 * ```typescript
 * const queue = createSealQueue('sender', protocol.seal, logger, (wire) => transport.post(wire), (packet, reason) => report(reason))
 * ```
 */
export const createSealQueue: SealQueueCreater = (label, seal, logger, onSuccess, onFail) => {
  const validity = isValidQueueCreaterArguments({ label, operation: seal, logger, onSuccess, onFail })
  const errorMessage = getValidationError('seal', validity)
  if (errorMessage) {
    throw createError(errorMessage)
  }
  const { debug, error } = logger
  // why: onFail is the consumer's code; a throw there must not re-enter the outer catch, which would report the same packet twice, or reject the stage and stall the queue behind it.
  const fail = (...report: Parameters<QueueFailureHandler>): void => {
    try {
      onFail(...report)
    } catch (e) {
      error(`${label}: onFail threw. ${e}`)
    }
  }
  const process = async (raw: UnencryptedPacket): Promise<void> => {
    try {
      debug(`${label}: Check packet is valid`)
      if (!isValidUnencryptedPacket(raw)) {
        error(`${label}: Invalid packet ignored`)
        fail(raw, 'Invalid packet ignored')
        return
      }
      debug(`${label}: Seal packet`)
      let sealed: WirePacket
      try {
        sealed = await seal(raw)
      } catch (e) {
        error(`${label}: ${(e as Error)?.message}`)
        fail(raw, `${(e as Error)?.message}`, e)
        return
      }
      debug(`${label}: Check sealed packet is valid`)
      if (!isValidWirePacket(sealed)) {
        error(`${label}: Sealed packet is not valid`)
        fail(raw, 'Sealed packet is not valid')
        return
      }
      onSuccess(sealed)
    } catch (e) {
      error(`An unexpected error occurred. ${e}`)
      fail(raw, `An unexpected error occurred. ${e}`, e)
    }
  }
  return createQueue<UnencryptedPacket>(process)
}
