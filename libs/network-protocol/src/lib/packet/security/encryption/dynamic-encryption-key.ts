/* eslint-disable @typescript-eslint/no-explicit-any */
import type { EncryptionSuite, FirstMessageHandler } from '../../../security/model'
import type { PacketEncrypter, PacketDecrypter } from '../../model'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Creates a factory for dynamic key-based encryption suites.
 *
 * This factory accepts packet encryption and decryption functions and returns a function
 * that creates encryption suites with dynamic key providers. The key provider is evaluated
 * at the time of each encryption/decryption operation, allowing for keys to change dynamically.
 *
 * **First Message Handling:**
 * When the key provider returns undefined/empty (first message scenario), the encryption
 * is skipped and the packet is passed through with a special marker. On the receiving end,
 * when no key exists, decryption is skipped and the data is parsed directly.
 *
 * @template T The type of the data to be encrypted or decrypted.
 * @param {PacketEncrypter} encryptPacket - Function to encrypt a packet with a password
 * @param {PacketDecrypter} decryptPacket - Function to decrypt a packet with a password
 * @param {FirstMessageHandler<T>} firstMessageHandler - Handler for first message (no key) scenarios
 * @returns {(provider: () => string) => EncryptionSuite<T>} A factory function that accepts a key provider and returns an encryption suite
 *
 * @example Creating a dynamic key encryption suite
 * ```typescript
 * const factory = createDynamicKeyEncryptionFactory(encryptPacket, decryptPacket, firstMessageHandler)
 * let sessionKey: string | undefined
 * const suite = factory(() => sessionKey)
 * const encrypted = await suite.packetEncryption(packet)
 * ```
 */
export function createDynamicKeyEncryptionFactory<T = any>(
  encryptPacket: PacketEncrypter,
  decryptPacket: PacketDecrypter,
  firstMessageHandler: FirstMessageHandler<T>
) {
  return (provider: () => string | undefined): EncryptionSuite<T> => {
    const packetEncryption: EncryptionSuite<T>['packetEncryption'] = (packet) => {
      const key = provider()
      if (!key) {
        return firstMessageHandler.serializeWithoutEncryption(packet)
      }
      return encryptPacket(packet, key)
    }

    const packetDecryption: EncryptionSuite<T>['packetDecryption'] = (packet) => {
      const key = provider()
      if (!key) {
        return firstMessageHandler.deserializeWithoutDecryption(packet)
      }
      return decryptPacket(packet, key)
    }

    return freeze({ packetEncryption, packetDecryption })
  }
}
