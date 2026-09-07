/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@hyperfrontend/logging'
import type { PacketOpener, PacketSealer, UnencryptedPacket, WirePacket } from '../packet/model'

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

/** Called with the rejected input, why it was rejected, and the error the operation threw when it threw one */
export type QueueFailureHandler = (raw: unknown, reason: string, cause?: unknown) => void

/** The packet operation a specialised queue runs */
export type QueueOperation = PacketSealer | PacketOpener

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
  onFail: QueueFailureHandler
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

/** Factory function for creating seal queues */
export type SealQueueCreater = (
  label: string,
  seal: PacketSealer,
  logger: Logger,
  onSuccess: (packet: WirePacket) => void,
  onFail: QueueFailureHandler
) => Queue<UnencryptedPacket>

/** Factory function for creating open queues */
export type OpenQueueCreater = (
  label: string,
  open: PacketOpener,
  logger: Logger,
  onSuccess: (packet: UnencryptedPacket) => void,
  onFail: QueueFailureHandler
) => Queue<WirePacket>
