import type { UnencryptedPacket, UnserializedEncryptedPacket } from '../../packet/model'
import type { EncryptionQueueCreater } from '../model'
import { isValidUnencryptedPacket } from '../../packet/validations/is-valid-unencrypted-packet'
import { isValidUnserializedEncryptedPacket } from '../../packet/validations/is-valid-unserialized-encrypted-packet'
import { isValidQueueCreaterArguments } from '../validations/is-valid-queue-creater-arguments'
import { getValidationError } from '../utils/get-validation-error'
import { createQueue } from './create-queue'

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
    throw new Error(errorMessage)
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
        error(`${label}: ${(e as Error)?.message}`)
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
