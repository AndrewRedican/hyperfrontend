/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Data } from '../data/model'

/** Obfuscated packet represented as raw bytes */
export type ObfuscatedPacket = Uint8Array

/** Base interface for all packet types */
export interface PacketBase {
  /** Identifies the origin of the packet */
  readonly origin: string
  /** Identifies the intended recipient of the packet */
  readonly target: string
}

/** Packet containing unencrypted data */
export interface UnencryptedPacket<T = any> extends PacketBase {
  /** Unencrypted data */
  readonly data: Data<T>
}

/** Packet with binary encrypted data before serialization */
export interface UnserializedEncryptedPacket extends PacketBase {
  /** Unserialized (binary form) encrypted data */
  readonly data: Uint8Array
}

/** Packet with serialized encrypted data as string */
export interface SerializedEncryptedPacket extends PacketBase {
  /** Serialized and encrypted data message */
  readonly data: string
}

/** Packet before obfuscation, with data in any encryption state */
export interface UnobfuscatedPacket<T = any> extends PacketBase {
  /** Nondescrypt formatted data */
  readonly data: UnencryptedPacket<T>['data'] | UnserializedEncryptedPacket['data'] | SerializedEncryptedPacket['data']
}

/** Union type representing any packet state */
export type Packet<T = any> = ObfuscatedPacket | UnobfuscatedPacket<T>

/** Encrypts an unencrypted packet using a password */
export type PacketEncrypter = <T = any>(packet: UnencryptedPacket<T>, password: string) => Promise<UnserializedEncryptedPacket>

/** Decrypts a packet using a password */
export type PacketDecrypter = <T = any>(packet: UnserializedEncryptedPacket, password: string) => Promise<UnencryptedPacket<T>>

/** Obfuscates a serialized encrypted packet */
export type PacketObfuscater = (packet: SerializedEncryptedPacket, password: string) => Promise<ObfuscatedPacket>

/** Deobfuscates an obfuscated packet */
export type PacketDeobfuscater = (packet: ObfuscatedPacket, password: string) => Promise<SerializedEncryptedPacket>

/** Password-bound packet encryption function */
export type PacketEncryption<T = any> = (packet: UnencryptedPacket<T>) => Promise<UnserializedEncryptedPacket>

/** Password-bound packet decryption function */
export type PacketDecryption<T = any> = (packet: UnserializedEncryptedPacket) => Promise<UnencryptedPacket<T>>

/** Serializes an encrypted packet to string format */
export type PacketSerialization = (packet: UnserializedEncryptedPacket) => SerializedEncryptedPacket

/** Deserializes a string packet to binary format */
export type PacketDeserialization = (packet: SerializedEncryptedPacket) => UnserializedEncryptedPacket

/** Password-bound packet obfuscation function */
export type PacketObfuscation = (packet: SerializedEncryptedPacket) => Promise<ObfuscatedPacket>

/** Password-bound packet deobfuscation function */
export type PacketDeobfuscation = (packet: ObfuscatedPacket) => Promise<SerializedEncryptedPacket>
