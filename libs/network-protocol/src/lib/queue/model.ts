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

/** Message processing queue interface */
export interface Queue<T extends object> {
  /** Adds a message to the queue */
  readonly addMessage: (message: T) => void
  /** Returns whether the queue is processing messages */
  readonly isRunning: () => boolean
  /** Stops queue processing */
  readonly stop: () => void
  /** Resumes queue processing */
  readonly resume: () => void
  /** Returns the number of messages in the queue */
  readonly size: () => number
  /** Returns the message currently being processed */
  readonly currentMessage: () => T | null
}

/** Function that handles messages from a queue */
export type MessageHandler<T extends object> = (message: T) => Promise<void> | void

/** Union of all packet operation types for queue processing */
export type QueueOperation =
  | PacketEncryption
  | PacketSerialization
  | PacketObfuscation
  | PacketDeobfuscation
  | PacketDeserialization
  | PacketDecryption

/** Arguments for creating a queue instance */
export interface QueueCreatorArguments<T = any> {
  /** Queue label for logging */
  label: string
  /** Packet operation function */
  operation: QueueOperation
  /** Logger instance */
  logger: Logger
  /** Callback on successful packet processing */
  onSuccess: (packet: T) => void
  /** Callback on packet processing failure */
  onFail: (raw: unknown) => void
}

/** Validation result for queue creator arguments */
export interface QueueCreatorValidity {
  /** Whether label is valid */
  label: boolean
  /** Whether operation is valid */
  operation: boolean
  /** Whether logger is valid */
  logger: boolean
  /** Whether onSuccess callback is valid */
  onSuccess: boolean
  /** Whether onFail callback is valid */
  onFail: boolean
}

/** Factory function for creating encryption queues */
export type EncryptionQueueCreater = (
  label: string,
  packetEncryption: PacketEncryption,
  logger: Logger,
  onSuccess: (packet: UnserializedEncryptedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<UnencryptedPacket>

/** Factory function for creating serialization queues */
export type SerializationQueueCreater = (
  label: string,
  packetSerialization: PacketSerialization,
  logger: Logger,
  onSuccess: (packet: SerializedEncryptedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<UnserializedEncryptedPacket>

/** Factory function for creating obfuscation queues */
export type ObfuscationQueueCreater = (
  label: string,
  packetObfuscation: PacketObfuscation,
  logger: Logger,
  onSuccess: (packet: ObfuscatedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<SerializedEncryptedPacket>

/** Factory function for creating deobfuscation queues */
export type DeobfuscationQueueCreater = (
  label: string,
  packetDeobfuscation: PacketDeobfuscation,
  logger: Logger,
  onSuccess: (packet: SerializedEncryptedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<ObfuscatedPacket>

/** Factory function for creating deserialization queues */
export type DeserializationQueueCreater = (
  label: string,
  packetDeserialization: PacketDeserialization,
  logger: Logger,
  onSuccess: (packet: UnserializedEncryptedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<SerializedEncryptedPacket>

/** Factory function for creating decryption queues */
export type DecryptionQueueCreater = (
  label: string,
  packetDecryption: PacketDecryption,
  logger: Logger,
  onSuccess: (packet: UnencryptedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<UnserializedEncryptedPacket>
