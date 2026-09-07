/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@hyperfrontend/logging'
import type { PacketDropHandler, PacketOpener, UnencryptedPacket } from '../packet/model'

/** Callback invoked with each opened packet */
export type ReceivePacketFn<T = any> = (packet: UnencryptedPacket<T>) => void

/** Function to receive raw wire bytes */
export type ReceiveFn = (packet: Uint8Array) => void

/** Represents an inbound processing queue with measurable size */
export interface InboundQueue {
  /** Number of items in the queue */
  readonly size: number
}

/** Receiver interface for processing inbound frames */
export interface Receiver {
  /** Feeds an incoming frame into the pipeline */
  readonly receive: ReceiveFn
  /** Pauses frame processing */
  readonly stop: () => void
  /** Resumes frame processing */
  readonly resume: () => void
  /** The frames waiting to be opened */
  readonly queue: InboundQueue
}

/** Factory function type for creating a Receiver instance; `onDrop` receives each frame the opener rejects */
export type CreateReceiver<T = any> = (
  label: string,
  receiver: ReceivePacketFn<T>,
  logger: Logger,
  open: PacketOpener<T>,
  onDrop?: PacketDropHandler
) => Receiver

/** Alias for CreateReceiver factory type */
export type ReceiverFactory = CreateReceiver
