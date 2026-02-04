/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  PacketEncryption,
  PacketDecryption,
  PacketObfuscation,
  PacketDeobfuscation,
  UnencryptedPacket,
  UnserializedEncryptedPacket,
} from '../packet/model'

export type { PacketObfuscation, PacketDeobfuscation, PacketEncryption, PacketDecryption }

export interface EncryptionSuite<T = any> {
  packetEncryption: PacketEncryption<T>
  packetDecryption: PacketDecryption<T>
}

export interface ObfuscationSuite {
  packetObfuscation: PacketObfuscation
  packetDeobfuscation: PacketDeobfuscation
}

export interface SecuritySuite<T = any> extends EncryptionSuite<T>, ObfuscationSuite {}

/**
 * Handler for first message scenarios where no encryption key exists yet.
 *
 * In the dynamic key exchange protocol, the first message is sent without encryption
 * (only obfuscation) because no shared key has been established yet. This handler
 * provides methods to serialize/deserialize packets without the encryption step.
 */
export interface FirstMessageHandler<T = any> {
  /**
   * Serializes an unencrypted packet for transmission without encryption.
   * Used when sending the first message before key exchange.
   */
  serializeWithoutEncryption: (packet: UnencryptedPacket<T>) => Promise<UnserializedEncryptedPacket>

  /**
   * Deserializes a packet that was sent without encryption.
   * Used when receiving the first message before key exchange.
   */
  deserializeWithoutDecryption: (packet: UnserializedEncryptedPacket) => Promise<UnencryptedPacket<T>>
}
