import type { UnserializedEncryptedPacket, UnencryptedPacket } from '../../packet/model'
import type { DecryptionQueueCreater } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isValidUnencryptedPacket } from '../../packet/validations/is-valid-unencrypted-packet'
import { isValidUnserializedEncryptedPacket } from '../../packet/validations/is-valid-unserialized-encrypted-packet'
import { getValidationError } from '../utils/get-validation-error'
import { isValidQueueCreaterArguments } from '../validations/is-valid-queue-creater-arguments'
import { createQueue } from './create-queue'

export const createDecryptionQueue: DecryptionQueueCreater = (label, packetDecryption, logger, onSuccess, onFail) => {
  const validity = isValidQueueCreaterArguments({
    label,
    operation: packetDecryption,
    logger,
    onSuccess,
    onFail,
  })
  const errorMessage = getValidationError('decryption', validity)
  if (errorMessage) {
    throw createError(errorMessage)
  }
  const { debug, log, warn, error } = logger
  const process = async (raw: UnserializedEncryptedPacket): Promise<void> => {
    try {
      debug(`${label}: Check packet is valid`)
      if (!isValidUnserializedEncryptedPacket(raw)) {
        log(`${label}: Non unserialized-encrypted packet ignored`)
        onFail(raw)
        return
      }
      debug(`${label}: Decrypt packet`)
      let processed: UnencryptedPacket
      try {
        processed = await packetDecryption(raw)
      } catch (e) {
        log(`${label}: ${(<Error>e)?.message}`)
        onFail(raw)
        return
      }
      debug(`${label}: Check decrypted packet is valid`)
      if (!isValidUnencryptedPacket(processed)) {
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
  return createQueue<UnserializedEncryptedPacket>(process)
}
