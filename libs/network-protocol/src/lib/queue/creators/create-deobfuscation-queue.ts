import type { ObfuscatedPacket, SerializedEncryptedPacket } from '../../packet/model'
import type { DeobfuscationQueueCreater } from '../model'
import { isValidObfuscatedPacket, isValidSerializedEncryptedPacket } from '../../packet/validations'
import { isValidQueueCreaterArguments } from '../validations'
import { getValidationError } from '../utils'
import { createQueue } from './create-queue'

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
    throw new Error(errorMessage)
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
        log(`${label}: ${(e as Error)?.message}`)
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
