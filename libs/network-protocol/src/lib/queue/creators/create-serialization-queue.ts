import type { UnserializedEncryptedPacket, SerializedEncryptedPacket } from '../../packet/model'
import type { SerializationQueueCreater } from '../model'
import { isValidUnserializedEncryptedPacket, isValidSerializedEncryptedPacket } from '../../packet/validations'
import { isValidQueueCreaterArguments } from '../validations'
import { getValidationError } from '../utils'
import { createQueue } from '.'

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
    throw new Error(errorMessage)
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
        error(`${label}: ${(e as Error)?.message}`)
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
