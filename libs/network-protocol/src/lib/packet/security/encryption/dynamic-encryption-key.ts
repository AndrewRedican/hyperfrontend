/* eslint-disable @typescript-eslint/no-explicit-any */
import type { EncryptionSuite, PacketEncryption, PacketDecryption } from '../../../security/model'

/**
 * Creates a factory for dynamic key-based encryption suites.
 *
 * This factory accepts packet encryption and decryption functions and returns a function
 * that creates encryption suites with dynamic key providers. The key provider is evaluated
 * at the time of each encryption/decryption operation, allowing for keys to change dynamically.
 *
 * @template T The type of the data to be encrypted or decrypted.
 * @param {PacketEncryption<T>} encryptPacket - Function to encrypt a packet with a password
 * @param {PacketDecryption<T>} decryptPacket - Function to decrypt a packet with a password
 * @returns {(provider: () => string) => EncryptionSuite<T>} A factory function that accepts a key provider and returns an encryption suite
 */
export function createDynamicKeyEncryptionFactory<T = any>(encryptPacket: PacketEncryption<T>, decryptPacket: PacketDecryption<T>) {
  return (provider: () => string): EncryptionSuite<T> => {
    const packetEncryption: EncryptionSuite<T>['packetEncryption'] = (packet) => encryptPacket(packet, provider())
    const packetDecryption: EncryptionSuite<T>['packetDecryption'] = (packet) => decryptPacket(packet, provider())
    return Object.freeze({ packetEncryption, packetDecryption })
  }
}
