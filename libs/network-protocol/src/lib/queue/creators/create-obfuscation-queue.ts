import type { SerializedEncryptedPacket, ObfuscatedPacket } from '../../packet/model'
import type { ObfuscationQueueCreater } from '../model'
import { isValidSerializedEncryptedPacket, isValidObfuscatedPacket } from '../../packet/validations'
import { isValidQueueCreaterArguments } from '../validations'
import { getValidationError } from '../utils'
import { createQueue } from '../creators'

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
    throw new Error(errorMessage)
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
        error(`${label}: ${(e as Error)?.message}`)
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
