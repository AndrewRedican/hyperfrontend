/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@hyperfrontend/logging'
import type { Data } from '../data/model'
import type { PacketEncryption, PacketObfuscation } from '../packet/model'

/** Callback invoked to transmit raw packet bytes */
export type SendPacketFn = (packet: Uint8Array) => void

/** Function to send data from an origin to a target */
export type SendFn<T = any> = (origin: string, target: string, data: Data<T>) => void

/** Represents an outbound processing queue with measurable size */
export interface OutboundQueue {
  /** Number of items in the queue */
  readonly size: number
}

/** Collection of outbound processing queues */
export interface OutboundQueues {
  /** Queue for packets awaiting encryption */
  readonly encryptionQueue: OutboundQueue
  /** Queue for packets awaiting serialization */
  readonly serializationQueue: OutboundQueue
  /** Queue for packets awaiting obfuscation */
  readonly obfuscationQueue: OutboundQueue
}

/** Sender interface for processing outbound packets */
export interface Sender<T = any> extends OutboundQueues {
  /** Sends data from origin to target */
  readonly send: SendFn<T>
  /** Pauses packet processing */
  readonly stop: () => void
  /** Resumes packet processing */
  readonly resume: () => void
}

/** Factory function type for creating a Sender instance */
export type CreateSender<T = any> = (
  label: string,
  sender: SendPacketFn,
  logger: Logger,
  packetEncryption: PacketEncryption<T>,
  packetObfuscation: PacketObfuscation
) => Sender<T>

/** Alias for CreateSender factory type */
export type SenderFactory = CreateSender
