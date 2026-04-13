import type { ObfuscatedPacket, SerializedEncryptedPacket } from '../../packet/model'
import type { DeobfuscationQueueCreater } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isValidObfuscatedPacket } from '../../packet/validations/is-valid-obfuscated-packet'
import { isValidSerializedEncryptedPacket } from '../../packet/validations/is-valid-serialized-encrypted-packet'
import { getValidationError } from '../utils/get-validation-error'
import { isValidQueueCreaterArguments } from '../validations/is-valid-queue-creater-arguments'
import { createQueue } from './create-queue'

/**
 * Creates a deobfuscation queue for processing obfuscated packets.
 *
 * @param label - Identifier for the queue used in logging
 * @param packetDeobfuscation - Function to deobfuscate packets
 * @param logger - Logger instance for debug and error messages
 * @param onSuccess - Callback invoked when a packet is successfully deobfuscated
 * @param onFail - Callback invoked when deobfuscation fails
 * @returns A queue instance for processing obfuscated packets
 *
 * @example Creating a deobfuscation queue
 * ```typescript
 * const queue = createDeobfuscationQueue(
 *   'receiver',
 *   async (packet) => ({ ...packet, data: deobfuscate(packet.data) }),
 *   logger,
 *   (deobfuscated) => handleDeobfuscated(deobfuscated),
 *   (failed) => handleFailed(failed)
 * )
 * ```
 */
export const createDeobfuscationQueue: DeobfuscationQueueCreater = (label, packetDeobfuscation, logger, onSuccess, onFail) => {
  const validity = isValidQueueCreaterArguments({
    label,
    operation: packetDeobfuscation,
    logger,
    onSuccess,
    onFail,
  })
  const errorMessage = getValidationError('deobfuscation', validity)
  if (errorMessage) {
    throw createError(errorMessage)
  }
  const { debug, log, warn, error } = logger
  const process = async (raw: ObfuscatedPacket): Promise<void> => {
    try {
      debug(`${label}: Check packet is valid`)
      if (!isValidObfuscatedPacket(raw)) {
        log(`${label}: Non obfuscated packet ignored`)
        onFail(raw)
        return
      }
      debug(`${label}: Deobfuscate packet`)
      let processed: SerializedEncryptedPacket
      try {
        processed = await packetDeobfuscation(raw)
      } catch (e) {
        log(`${label}: ${(<Error>e)?.message}`)
        onFail(raw)
        return
      }
      debug(`${label}: Check deobfuscated packet is valid`)
      if (!isValidSerializedEncryptedPacket(processed)) {
        warn(`${label}: Packet is not valid`)
        onFail(raw)
        return
      }
      onSuccess(processed)
    } catch (e) {
      error(`An unexpected error occurred. ${e}`)
      onFail(raw)
    }
  }
  return createQueue<ObfuscatedPacket>(process)
}
