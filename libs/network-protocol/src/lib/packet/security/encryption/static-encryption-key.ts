/* eslint-disable @typescript-eslint/no-explicit-any */
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import type { EncryptionSuite } from '../../../security/model'
import type { PacketEncrypter, PacketDecrypter } from '../../../packet/model'

/**
 * Creates a factory for static key-based encryption suites.
 *
 * This factory accepts packet encryption and decryption functions and returns a function
 * that creates encryption suites with a pre-shared static key. This is the simpler encryption
 * model where both parties share the same key beforehand.
 *
 * Use cases:
 * - Pre-shared key (PSK) scenarios where key exchange is handled externally
 * - Simplified setups where dynamic key rotation isn't required
 * - Testing and integration scenarios
 *
 * @template T The type of the data to be encrypted or decrypted.
 * @param {PacketEncrypter} encryptPacket - Function to encrypt a packet with a password
 * @param {PacketDecrypter} decryptPacket - Function to decrypt a packet with a password
 * @returns {(key: string) => EncryptionSuite<T>} A factory function that accepts a static key and returns an encryption suite
 */
export function createStaticKeyEncryptionFactory<T = any>(encryptPacket: PacketEncrypter, decryptPacket: PacketDecrypter) {
  return (key: string): EncryptionSuite<T> => {
    if (!key || typeof key !== 'string') {
      throw new Error('Static encryption key must be a non-empty string')
    }

    const packetEncryption: EncryptionSuite<T>['packetEncryption'] = (packet) => encryptPacket(packet, key)
    const packetDecryption: EncryptionSuite<T>['packetDecryption'] = (packet) => decryptPacket(packet, key)

    return freeze({ packetEncryption, packetDecryption })
  }
}
