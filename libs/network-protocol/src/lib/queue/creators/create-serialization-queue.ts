import type { UnserializedEncryptedPacket, SerializedEncryptedPacket } from '../../packet/model'
import type { SerializationQueueCreater } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isValidSerializedEncryptedPacket } from '../../packet/validations/is-valid-serialized-encrypted-packet'
import { isValidUnserializedEncryptedPacket } from '../../packet/validations/is-valid-unserialized-encrypted-packet'
import { getValidationError } from '../utils/get-validation-error'
import { isValidQueueCreaterArguments } from '../validations/is-valid-queue-creater-arguments'
import { createQueue } from './create-queue'

export const createSerializationQueue: SerializationQueueCreater = (label, packetSerialization, logger, onSuccess, onFail) => {
  const validity = isValidQueueCreaterArguments({
    label,
    operation: packetSerialization,
    logger,
    onSuccess,
    onFail,
  })
  const errorMessage = getValidationError('serialization', validity)
  if (errorMessage) {
    throw createError(errorMessage)
  }
  const { debug, error } = logger
  const process = async (raw: UnserializedEncryptedPacket): Promise<void> => {
    try {
      debug(`${label}: Check packet is valid`)
      if (!isValidUnserializedEncryptedPacket(raw)) {
        error(`${label}: Non unserialized-encrypted packet ignored`)
        onFail(raw)
        return
      }
      debug(`${label}: Serialize packet data`)
      let processed: SerializedEncryptedPacket
      try {
        processed = await packetSerialization(raw)
      } catch (e) {
        error(`${label}: ${(<Error>e)?.message}`)
        onFail(raw)
        return
      }
      debug(`${label}: Check serialized packet is valid`)
      if (!isValidSerializedEncryptedPacket(processed)) {
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
  return createQueue<UnserializedEncryptedPacket>(process)
}
