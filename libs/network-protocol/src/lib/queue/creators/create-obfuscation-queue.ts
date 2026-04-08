import type { SerializedEncryptedPacket, ObfuscatedPacket } from '../../packet/model'
import type { ObfuscationQueueCreater } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isValidObfuscatedPacket } from '../../packet/validations/is-valid-obfuscated-packet'
import { isValidSerializedEncryptedPacket } from '../../packet/validations/is-valid-serialized-encrypted-packet'
import { getValidationError } from '../utils/get-validation-error'
import { isValidQueueCreaterArguments } from '../validations/is-valid-queue-creater-arguments'
import { createQueue } from './create-queue'

/**
 * Creates an obfuscation queue for processing serialized encrypted packets.
 *
 * @param label - Identifier for the queue used in logging
 * @param packetObfuscation - Function to obfuscate packets
 * @param logger - Logger instance for debug and error messages
 * @param onSuccess - Callback invoked when a packet is successfully obfuscated
 * @param onFail - Callback invoked when obfuscation fails
 * @returns A queue instance for processing serialized packets
 *
 * @example
 * ```typescript
 * const queue = createObfuscationQueue(
 *   'sender',
 *   async (packet) => ({ ...packet, data: obfuscate(packet.data) }),
 *   logger,
 *   (obfuscated) => handleObfuscated(obfuscated),
 *   (failed) => handleFailed(failed)
 * )
 * ```
 */
export const createObfuscationQueue: ObfuscationQueueCreater = (label, packetObfuscation, logger, onSuccess, onFail) => {
  const validity = isValidQueueCreaterArguments({
    label,
    operation: packetObfuscation,
    logger,
    onSuccess,
    onFail,
  })
  const errorMessage = getValidationError('obfuscation', validity)
  if (errorMessage) {
    throw createError(errorMessage)
  }
  const { debug, error } = logger
  const process = async (raw: SerializedEncryptedPacket): Promise<void> => {
    try {
      debug(`${label}: Check packet is valid`)
      if (!isValidSerializedEncryptedPacket(raw)) {
        error(`${label}: Non serialized-encrypted packet ignored`)
        onFail(raw)
        return
      }
      debug(`${label}: Obfuscate packet`)
      let processed: ObfuscatedPacket
      try {
        processed = await packetObfuscation(raw)
      } catch (e) {
        error(`${label}: ${(<Error>e)?.message}`)
        onFail(raw)
        return
      }
      debug(`${label}: Check obfuscated packet is valid`)
      if (!isValidObfuscatedPacket(processed)) {
        error(`${label}: Packet is not valid`)
        onFail(raw)
        return
      }
      onSuccess(processed)
    } catch (e) {
      error(`An unexpected error occurred. ${e}`)
      onFail(raw)
    }
  }
  return createQueue<SerializedEncryptedPacket>(process)
}
