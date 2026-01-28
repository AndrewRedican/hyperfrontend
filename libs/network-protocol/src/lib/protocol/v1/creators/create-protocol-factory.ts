/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@hyperfrontend/logging'
import type { ReceivePacketFn } from '../../../receiver/model'
import type { ProtocolProvider, Protocol } from '../../../channel/model'
import type { EncryptionSuite, ObfuscationSuite } from '../../../security/model'
import { isValidLogger } from '@hyperfrontend/logging'
import { isValidRefreshRate } from '../../../packet/security/obfuscation/is-valid-refresh-rate'
import { isValidSendFn, isValidReceiveFn } from '../validations'

/**
 * Creates a protocol factory function with injected encryption and obfuscation factories.
 *
 * The factory accepts:
 * - `createDynamicKeyEncryption`: A factory that creates encryption/decryption methods using a dynamic key provider
 * - `createTimeIntervalObfuscation`: A factory that creates obfuscation/deobfuscation methods using time-based keys
 *
 * @template T The type of data to be encrypted/decrypted
 * @param {(provider: () => string) => EncryptionSuite<T>} createDynamicKeyEncryption - Factory for creating dynamic key-based encryption
 * @param {(refreshRate: number) => ObfuscationSuite} createTimeIntervalObfuscation - Factory for creating time-based obfuscation
 * @returns {(logger: Logger, refreshRate?: number) => ProtocolProvider<T>} A function that creates protocol providers
 */
export function createProtocolFactory<T = any>(
  createDynamicKeyEncryption: (provider: () => string) => EncryptionSuite<T>,
  createTimeIntervalObfuscation: (refreshRate: number) => ObfuscationSuite
) {
  return (logger: Logger, refreshRate = 1): ProtocolProvider<T> => {
    if (!isValidLogger(logger)) {
      throw new Error('Cannot create protocol provider without a valid logger')
    }
    if (!isValidRefreshRate(refreshRate)) {
      throw new Error('Cannot create protocol provider without a valid refresh rate')
    }

    const protocolProvider: ProtocolProvider<T> = (...args) => {
      if (!isValidSendFn(args[0])) {
        throw new Error('Cannot create protocol without a valid send function')
      }
      if (!isValidReceiveFn(args[1])) {
        throw new Error('Cannot create protocol without a valid receive function')
      }

      let key: string
      const receive: ReceivePacketFn<T> = (packet) => {
        key = packet.data.key
        args[1](packet)
      }
      const getKey = () => key

      const { packetEncryption, packetDecryption } = createDynamicKeyEncryption(getKey)
      const { packetObfuscation, packetDeobfuscation } = createTimeIntervalObfuscation(refreshRate)

      const protocol: Protocol<T> = Object.freeze({
        packetEncryption,
        packetDecryption,
        packetObfuscation,
        packetDeobfuscation,
        send: args[0],
        receive,
        getLogger: () => logger,
      })

      return protocol
    }

    return protocolProvider
  }
}
