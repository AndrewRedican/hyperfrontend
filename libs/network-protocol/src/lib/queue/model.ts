/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@hyperfrontend/logging'
import type {
  UnencryptedPacket,
  UnserializedEncryptedPacket,
  SerializedEncryptedPacket,
  ObfuscatedPacket,
  PacketEncryption,
  PacketDecryption,
  PacketSerialization,
  PacketDeserialization,
  PacketObfuscation,
  PacketDeobfuscation,
} from '../packet/model'

export interface Queue<T extends object> {
  readonly addMessage: (message: T) => void
  readonly isRunning: () => boolean
  readonly stop: () => void
  readonly resume: () => void
  readonly size: () => number
  readonly currentMessage: () => T | null
}

export type MessageHandler<T extends object> = (message: T) => Promise<void> | void

export type QueueOperation =
  | PacketEncryption
  | PacketSerialization
  | PacketObfuscation
  | PacketDeobfuscation
  | PacketDeserialization
  | PacketDecryption

export interface QueueCreatorArguments<T = any> {
  label: string
  operation: QueueOperation
  logger: Logger
  onSuccess: (packet: T) => void
  onFail: (raw: unknown) => void
}

export interface QueueCreatorValidity {
  label: boolean
  operation: boolean
  logger: boolean
  onSuccess: boolean
  onFail: boolean
}

export type EncryptionQueueCreater = (
  label: string,
  packetEncryption: PacketEncryption,
  logger: Logger,
  onSuccess: (packet: UnserializedEncryptedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<UnencryptedPacket>

export type SerializationQueueCreater = (
  label: string,
  packetSerialization: PacketSerialization,
  logger: Logger,
  onSuccess: (packet: SerializedEncryptedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<UnserializedEncryptedPacket>

export type ObfuscationQueueCreater = (
  label: string,
  packetObfuscation: PacketObfuscation,
  logger: Logger,
  onSuccess: (packet: ObfuscatedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<SerializedEncryptedPacket>

export type DeobfuscationQueueCreater = (
  label: string,
  packetDeobfuscation: PacketDeobfuscation,
  logger: Logger,
  onSuccess: (packet: SerializedEncryptedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<ObfuscatedPacket>

export type DeserializationQueueCreater = (
  label: string,
  packetDeserialization: PacketDeserialization,
  logger: Logger,
  onSuccess: (packet: UnserializedEncryptedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<SerializedEncryptedPacket>

export type DecryptionQueueCreater = (
  label: string,
  packetDecryption: PacketDecryption,
  logger: Logger,
  onSuccess: (packet: UnencryptedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<UnserializedEncryptedPacket>
