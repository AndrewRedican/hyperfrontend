/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@hyperfrontend/logging'
import type { ProtocolProvider, Protocol } from '../../../channel/model'
import type { ReceivePacketFn } from '../../../receiver/model'
import type { EncryptionSuite, ObfuscationSuite } from '../../../security/model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isValidLogger } from '@hyperfrontend/logging'
import { isValidRefreshRate } from '../../../packet/security/obfuscation/is-valid-refresh-rate'
import { isValidReceiveFn } from '../../validations/is-valid-receive-fn'
import { isValidSendFn } from '../../validations/is-valid-send-fn'

/**
 * Creates a protocol factory function with obfuscation-only handshake encryption.
 *
 * This is the **Obfuscation-Only Handshake** protocol model (V1):
 * - **First message**: NO encryption (obfuscation only) - key transmitted in payload
 * - **Key capture**: Dynamic key extracted from `packet.data.key` on receive
 * - **Subsequent messages**: Encrypted with dynamically captured keys
 *
 * **Handshake Flow:**
 * 1. First outbound message: Obfuscated but NOT encrypted (no key exists yet)
 * 2. First inbound message: Deobfuscated, key extracted from `packet.data.key`
 * 3. Subsequent messages: Both obfuscated AND encrypted with dynamic keys
 *
 * **Security Note:**
 * The first message's encryption key is visible after deobfuscation. This is acceptable
 * when time-based obfuscation provides sufficient protection for the handshake.
 * For stronger first-message protection, use V2 (PSK Handshake) instead.
 *
 * Both protocols use time-based obfuscation as an additional security layer.
 *
 * @template T The type of data to be encrypted/decrypted
 * @param {(provider: () => string) => EncryptionSuite<T>} createDynamicKeyEncryption - Factory for dynamic key-based encryption
 * @param {(refreshRate: number) => ObfuscationSuite} createTimeIntervalObfuscation - Factory for time-based obfuscation
 * @returns {(logger: Logger, refreshRate?: number) => ProtocolProvider<T>} A function that creates protocol providers
 *
 * @example Creating a protocol provider with obfuscated handshake
 * ```typescript
 * const createProvider = createObfuscatedHandshakeProtocolFactory(
 *   createDynamicKeyEncryption,
 *   createTimeIntervalObfuscation
 * )
 * const protocolProvider = createProvider(logger, 5)
 * const protocol = protocolProvider(sendFn, receiveFn)
 * ```
 */
export function createObfuscatedHandshakeProtocolFactory<T = any>(
  createDynamicKeyEncryption: (provider: () => string) => EncryptionSuite<T>,
  createTimeIntervalObfuscation: (refreshRate: number) => ObfuscationSuite
) {
  return (logger: Logger, refreshRate = 1): ProtocolProvider<T> => {
    if (!isValidLogger(logger)) {
      throw createError('Cannot create protocol provider without a valid logger')
    }
    if (!isValidRefreshRate(refreshRate)) {
      throw createError('Cannot create protocol provider without a valid refresh rate')
    }

    const protocolProvider: ProtocolProvider<T> = (...args) => {
      if (!isValidSendFn(args[0])) {
        throw createError('Cannot create protocol without a valid send function')
      }
      if (!isValidReceiveFn(args[1])) {
        throw createError('Cannot create protocol without a valid receive function')
      }

      let key: string
      const receive: ReceivePacketFn<T> = (packet) => {
        key = packet.data.key
        args[1](packet)
      }
      const getKey = () => key

      const { packetEncryption, packetDecryption } = createDynamicKeyEncryption(getKey)
      const { packetObfuscation, packetDeobfuscation } = createTimeIntervalObfuscation(refreshRate)

      const protocol: Protocol<T> = freeze({
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

/**
 * Use `createObfuscatedHandshakeProtocolFactory` instead. This alias exists for backward compatibility.
 */
export const createProtocolFactory = createObfuscatedHandshakeProtocolFactory
