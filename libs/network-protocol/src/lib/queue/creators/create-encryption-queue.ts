import type { UnencryptedPacket, UnserializedEncryptedPacket } from '../../packet/model'
import type { EncryptionQueueCreater } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isValidUnencryptedPacket } from '../../packet/validations/is-valid-unencrypted-packet'
import { isValidUnserializedEncryptedPacket } from '../../packet/validations/is-valid-unserialized-encrypted-packet'
import { getValidationError } from '../utils/get-validation-error'
import { isValidQueueCreaterArguments } from '../validations/is-valid-queue-creater-arguments'
import { createQueue } from './create-queue'

/**
 * Creates an encryption queue for processing unencrypted packets.
 *
 * @param label - Identifier for the queue used in logging
 * @param packetEncryption - Function to encrypt packets
 * @param logger - Logger instance for debug and error messages
 * @param onSuccess - Callback invoked when a packet is successfully encrypted
 * @param onFail - Callback invoked when encryption fails
 * @returns A queue instance for processing unencrypted packets
 *
 * @example
 * ```typescript
 * const queue = createEncryptionQueue(
 *   'outgoing-messages',
 *   async (packet) => ({ ...packet, data: encrypt(packet.data) }),
 *   logger,
 *   (encrypted) => handleEncrypted(encrypted),
 *   (failed) => handleFailed(failed)
 * )
 * ```
 */
export const createEncryptionQueue: EncryptionQueueCreater = (label, packetEncryption, logger, onSuccess, onFail) => {
  const validity = isValidQueueCreaterArguments({
    label,
    operation: packetEncryption,
    logger,
    onSuccess,
    onFail,
  })
  const errorMessage = getValidationError('encryption', validity)
  if (errorMessage) {
    throw createError(errorMessage)
  }
  const { debug, error } = logger
  const process = async (raw: UnencryptedPacket): Promise<void> => {
    try {
      debug(`${label}: Check packet is valid`)
      if (!isValidUnencryptedPacket(raw)) {
        error(`${label}: Non-unencrypted packet ignored`)
        onFail(raw)
        return
      }
      debug(`${label}: Encrypt packet data`)
      let processed: UnserializedEncryptedPacket
      try {
        processed = await packetEncryption(raw)
      } catch (e) {
        error(`${label}: ${(<Error>e)?.message}`)
        onFail(raw)
        return
      }
      debug(`${label}: Check encrypted packet is valid`)
      if (!isValidUnserializedEncryptedPacket(processed)) {
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
  return createQueue<UnencryptedPacket>(process)
}
