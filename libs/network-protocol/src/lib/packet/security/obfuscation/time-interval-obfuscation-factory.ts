import type { ObfuscationSuite } from '../../../security/model'
import type { SerializedEncryptedPacket, ObfuscatedPacket, PacketObfuscater, PacketDeobfuscater } from '../../model'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isValidSerializedEncryptedPacket } from '../../validations/is-valid-serialized-encrypted-packet'
import { isValidRefreshRate } from './is-valid-refresh-rate'

/**
 * Creates a factory for time-interval based obfuscation suites.
 *
 * This factory accepts packet obfuscation/deobfuscation functions and time-based password generators,
 * then returns a function that creates obfuscation suites using time-based keys. The suite uses
 * passwords generated for current, previous, and next time windows to provide secure, time-aligned
 * obfuscation.
 *
 * @param {PacketObfuscater} obfuscatePacket - Function to obfuscate a packet with a password
 * @param {PacketDeobfuscater} deobfuscatePacket - Function to deobfuscate data with a password
 * @param {(date: Date, refreshRate: number, offset: number) => Promise<string>} getTimeBasedPassword - Function to get a time-based password
 * @param {(date: Date, refreshRate: number) => {current: () => Promise<string>, previous: () => Promise<string>, next: () => Promise<string>}} getTimeBasedPasswords - Function to get multiple time-based passwords
 * @returns {(refreshRate: number) => ObfuscationSuite} A factory function that accepts a refresh rate and returns an obfuscation suite
 */
export function createTimeIntervalObfuscationFactory(
  obfuscatePacket: PacketObfuscater,
  deobfuscatePacket: PacketDeobfuscater,
  getTimeBasedPassword: (date: Date, refreshRate: number, offset: number) => Promise<string>,
  getTimeBasedPasswords: (
    date: Date,
    refreshRate: number
  ) => {
    /** Gets password for current time window */
    current: () => Promise<string>
    /** Gets password for previous time window */
    previous: () => Promise<string>
    /** Gets password for next time window */
    next: () => Promise<string>
  }
) {
  return (refreshRate = 1): ObfuscationSuite => {
    if (!isValidRefreshRate(refreshRate)) {
      throw createError('A valid refresh rate must be provided.')
    }
    const now = () => createDate()
    const packetObfuscationFn: ObfuscationSuite['packetObfuscation'] = async (
      packet: SerializedEncryptedPacket
    ): Promise<ObfuscatedPacket> => {
      const password = await getTimeBasedPassword(now(), refreshRate, 0)
      return await obfuscatePacket(packet, password)
    }
    const packetDeobfuscationFn: ObfuscationSuite['packetDeobfuscation'] = async (data: ObfuscatedPacket) => {
      const { current, previous, next } = getTimeBasedPasswords(now(), refreshRate)
      const passwordGenerators = [current, previous, next]
      const tryDeobfuscateWithPassword = async (getPassword: () => Promise<string>) => {
        try {
          const password = await getPassword()
          const deobfuscated = await deobfuscatePacket(data, password)
          if (isValidSerializedEncryptedPacket(deobfuscated)) {
            return deobfuscated
          }
          // eslint-disable-next-line no-empty
        } catch {}
        return null
      }
      for (const getPassword of passwordGenerators) {
        const result = await tryDeobfuscateWithPassword(getPassword)
        if (result !== null) {
          return result
        }
      }
      throw createError('Could not deobfuscate data')
    }
    return freeze({ packetObfuscation: packetObfuscationFn, packetDeobfuscation: packetDeobfuscationFn })
  }
}
