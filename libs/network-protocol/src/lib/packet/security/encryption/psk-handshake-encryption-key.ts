/* eslint-disable @typescript-eslint/no-explicit-any */
import type { EncryptionSuite } from '../../../security/model'
import type { PacketEncrypter, PacketDecrypter } from '../../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Creates a factory for PSK-handshake encryption suites.
 *
 * This encryption model uses a **Pre-Shared Key (PSK)** for the first message only,
 * then switches to dynamically exchanged keys for all subsequent messages.
 *
 * **Handshake Flow:**
 * 1. **First outbound message**: Encrypted with PSK (both parties know this key beforehand)
 * 2. **First inbound message**: Decrypted with PSK, dynamic key extracted from `packet.data.key`
 * 3. **Subsequent messages**: Encrypted/decrypted with the dynamically captured key
 *
 * **Comparison with Obfuscation-Only Handshake (V1):**
 * - V1: First message has NO encryption (obfuscation only) - key travels in plaintext (after deobfuscation)
 * - V2 (PSK): First message IS encrypted with PSK - key travels encrypted
 *
 * **Security Benefit:**
 * The PSK handshake provides encryption from the very first message, preventing
 * the encryption key from being exposed even to attackers who can deobfuscate.
 *
 * @template T The type of the data to be encrypted or decrypted.
 * @param {PacketEncrypter} encryptPacket - Function to encrypt a packet with a password
 * @param {PacketDecrypter} decryptPacket - Function to decrypt a packet with a password
 * @returns {(psk: string, keyProvider: () => string | undefined) => EncryptionSuite<T>} A factory that creates hybrid PSK/dynamic encryption
 *
 * @example
 * ```typescript
 * const factory = createPSKHandshakeEncryptionFactory(encryptPacket, decryptPacket)
 * let sessionKey: string | undefined
 * const suite = factory('pre-shared-secret', () => sessionKey)
 * const encrypted = await suite.packetEncryption(packet)
 * ```
 */
export function createPSKHandshakeEncryptionFactory<T = any>(encryptPacket: PacketEncrypter, decryptPacket: PacketDecrypter) {
  return (psk: string, keyProvider: () => string | undefined): EncryptionSuite<T> => {
    if (!psk || typeof psk !== 'string') {
      throw createError('PSK must be a non-empty string')
    }

    const packetEncryption: EncryptionSuite<T>['packetEncryption'] = (packet) => {
      const dynamicKey = keyProvider()
      const key = dynamicKey || psk
      return encryptPacket(packet, key)
    }

    const packetDecryption: EncryptionSuite<T>['packetDecryption'] = (packet) => {
      const dynamicKey = keyProvider()
      const key = dynamicKey || psk
      return decryptPacket(packet, key)
    }

    return freeze({ packetEncryption, packetDecryption })
  }
}
