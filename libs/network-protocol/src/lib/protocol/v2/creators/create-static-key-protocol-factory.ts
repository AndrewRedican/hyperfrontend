/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@hyperfrontend/logging'
import type { ReceivePacketFn } from '../../../receiver/model'
import type { ProtocolProvider, Protocol } from '../../../channel/model'
import type { ObfuscationSuite } from '../../../security/model'
import type { PacketEncrypter, PacketDecrypter } from '../../../packet/model'
import { isValidLogger } from '@hyperfrontend/logging'
import { isValidRefreshRate } from '../../../packet/security/obfuscation/is-valid-refresh-rate'
import { isValidSendFn, isValidReceiveFn } from '../../validations'
import { createPSKHandshakeEncryptionFactory } from '../../../packet/security/encryption/psk-handshake-encryption-key'

/**
 * Creates a protocol factory function with PSK-based handshake encryption.
 *
 * This is the **Pre-Shared Key (PSK) Handshake** protocol model (V2):
 * - **First message**: Encrypted with PSK (both endpoints share key beforehand)
 * - **Key capture**: Dynamic key extracted from `packet.data.key` on receive
 * - **Subsequent messages**: Encrypted with dynamically captured keys
 *
 * **Comparison with V1 (Obfuscation-Only Handshake):**
 * - V1: First message has NO encryption (obfuscation only) - key visible after deobfuscation
 * - V2: First message IS encrypted with PSK - key never exposed, even after deobfuscation
 *
 * **Security Benefit:**
 * The PSK handshake provides encryption from the very first message, preventing
 * the encryption key from being exposed even to attackers who can deobfuscate.
 *
 * Both protocols use time-based obfuscation as an additional security layer.
 *
 * @template T The type of data to be encrypted/decrypted
 * @param {PacketEncrypter} encryptPacket - Function to encrypt a packet with password
 * @param {PacketDecrypter} decryptPacket - Function to decrypt a packet with password
 * @param {(refreshRate: number) => ObfuscationSuite} createTimeIntervalObfuscation - Factory for time-based obfuscation
 * @returns {(logger: Logger, sharedKey: string, refreshRate?: number) => ProtocolProvider<T>} A function that creates protocol providers
 */
export function createPSKHandshakeProtocolFactory<T = any>(
  encryptPacket: PacketEncrypter,
  decryptPacket: PacketDecrypter,
  createTimeIntervalObfuscation: (refreshRate: number) => ObfuscationSuite
) {
  const createPSKHandshakeEncryption = createPSKHandshakeEncryptionFactory(encryptPacket, decryptPacket)

  return (logger: Logger, sharedKey: string, refreshRate = 1): ProtocolProvider<T> => {
    if (!isValidLogger(logger)) {
      throw new Error('Cannot create protocol provider without a valid logger')
    }
    if (!sharedKey || typeof sharedKey !== 'string') {
      throw new Error('Cannot create protocol provider without a valid shared key')
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

      // Dynamic key capture - same as V1
      let key: string | undefined
      const receive: ReceivePacketFn<T> = (packet) => {
        key = packet.data.key
        args[1](packet)
      }
      const getKey = () => key

      // PSK handshake encryption: uses PSK when no dynamic key, then switches to dynamic
      const { packetEncryption, packetDecryption } = createPSKHandshakeEncryption(sharedKey, getKey)
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

/**
 * @deprecated Use `createPSKHandshakeProtocolFactory` instead. This alias exists for backward compatibility.
 */
export const createStaticKeyProtocolFactory = createPSKHandshakeProtocolFactory
