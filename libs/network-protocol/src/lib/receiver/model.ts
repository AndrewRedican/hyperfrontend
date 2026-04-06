/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@hyperfrontend/logging'
import type { UnencryptedPacket, PacketDeobfuscation, PacketDecryption } from '../packet/model'

/** Callback invoked when a decrypted packet is received */
export type ReceivePacketFn<T = any> = (packet: UnencryptedPacket<T>) => void

/** Function to receive raw packet data */
export type ReceiveFn = (packet: Uint8Array) => void

/** Represents a queue with a measurable size */
export interface InboundQueue {
  /** Number of items in the queue */
  readonly size: number
}

/** Collection of inbound processing queues */
export interface InboundQueues {
  /** Queue for packets awaiting deobfuscation */
  readonly deobfuscationQueue: InboundQueue
  /** Queue for packets awaiting deserialization */
  readonly deserializationQueue: InboundQueue
  /** Queue for packets awaiting decryption */
  readonly decryptionQueue: InboundQueue
}

/** Receiver interface for processing inbound packets */
export interface Receiver extends InboundQueues {
  /** Processes an incoming raw packet */
  readonly receive: ReceiveFn
  /** Pauses packet processing */
  readonly stop: () => void
  /** Resumes packet processing */
  readonly resume: () => void
}

/** Factory function type for creating a Receiver instance */
export type CreateReceiver<T = any> = (
  label: string,
  receiver: ReceivePacketFn<T>,
  logger: Logger,
  packetDeobfuscation: PacketDeobfuscation,
  packetDecryption: PacketDecryption<T>
) => Receiver

/** Alias for CreateReceiver factory type */
export type ReceiverFactory = CreateReceiver
