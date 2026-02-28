/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Data } from '../data/model'

export type ObfuscatedPacket = Uint8Array

export interface PacketBase {
  /** Identifies the origin of the packet */
  readonly origin: string
  /** Identifies the intended recipient of the packet */
  readonly target: string
}

export interface UnencryptedPacket<T = any> extends PacketBase {
  /** Unencrypted data */
  readonly data: Data<T>
}

export interface UnserializedEncryptedPacket extends PacketBase {
  /** Unserialized (binary form) encrypted data */
  readonly data: Uint8Array
}

export interface SerializedEncryptedPacket extends PacketBase {
  /** Serialized and encrypted data message */
  readonly data: string
}

export interface UnobfuscatedPacket<T = any> extends PacketBase {
  /** Nondescrypt formatted data */
  readonly data: UnencryptedPacket<T>['data'] | UnserializedEncryptedPacket['data'] | SerializedEncryptedPacket['data']
}

export type Packet<T = any> = ObfuscatedPacket | UnobfuscatedPacket<T>

export type PacketEncrypter = <T = any>(packet: UnencryptedPacket<T>, password: string) => Promise<UnserializedEncryptedPacket>

export type PacketDecrypter = <T = any>(packet: UnserializedEncryptedPacket, password: string) => Promise<UnencryptedPacket<T>>

export type PacketObfuscater = (packet: SerializedEncryptedPacket, password: string) => Promise<ObfuscatedPacket>

export type PacketDeobfuscater = (packet: ObfuscatedPacket, password: string) => Promise<SerializedEncryptedPacket>

export type PacketEncryption<T = any> = (packet: UnencryptedPacket<T>) => Promise<UnserializedEncryptedPacket>

export type PacketDecryption<T = any> = (packet: UnserializedEncryptedPacket) => Promise<UnencryptedPacket<T>>

export type PacketSerialization = (packet: UnserializedEncryptedPacket) => SerializedEncryptedPacket

export type PacketDeserialization = (packet: SerializedEncryptedPacket) => UnserializedEncryptedPacket

export type PacketObfuscation = (packet: SerializedEncryptedPacket) => Promise<ObfuscatedPacket>

export type PacketDeobfuscation = (packet: ObfuscatedPacket) => Promise<SerializedEncryptedPacket>
