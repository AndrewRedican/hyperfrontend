import type { SerializedEncryptedPacket, UnserializedEncryptedPacket } from '../../packet/model'
import type { DeserializationQueueCreater } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isValidSerializedEncryptedPacket } from '../../packet/validations/is-valid-serialized-encrypted-packet'
import { isValidUnserializedEncryptedPacket } from '../../packet/validations/is-valid-unserialized-encrypted-packet'
import { getValidationError } from '../utils/get-validation-error'
import { isValidQueueCreaterArguments } from '../validations/is-valid-queue-creater-arguments'
import { createQueue } from './create-queue'

export const createDeserializationQueue: DeserializationQueueCreater = (label, packetDeserialization, logger, onSuccess, onFail) => {
  const validity = isValidQueueCreaterArguments({
    label,
    operation: packetDeserialization,
    logger,
    onSuccess,
    onFail,
  })
  const errorMessage = getValidationError('deserialization', validity)
  if (errorMessage) {
    throw createError(errorMessage)
  }
  const { debug, log, warn, error } = logger
  const process = async (raw: SerializedEncryptedPacket): Promise<void> => {
    try {
      debug(`${label}: Check packet is valid`)
      if (!isValidSerializedEncryptedPacket(raw)) {
        log(`${label}: Non serialized-encrypted packet ignored`)
        onFail(raw)
        return
      }
      debug(`${label}: Deserialize packet`)
      let processed: UnserializedEncryptedPacket
      try {
        processed = await packetDeserialization(raw)
      } catch (e) {
        log(`${label}: ${(<Error>e)?.message}`)
        onFail(raw)
        return
      }
      debug(`${label}: Check deserialized packet is valid`)
      if (!isValidUnserializedEncryptedPacket(processed)) {
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
  return createQueue<SerializedEncryptedPacket>(process)
}
