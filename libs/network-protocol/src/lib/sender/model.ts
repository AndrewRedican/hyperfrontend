/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@hyperfrontend/logging'
import type { Data } from '../data/model'
import type { PacketDropHandler, PacketSealer } from '../packet/model'

/** Callback invoked to transmit sealed wire bytes */
export type SendPacketFn = (packet: Uint8Array) => void

/** Function to send data from an origin to a target */
export type SendFn<T = any> = (origin: string, target: string, data: Data<T>) => void

/** Represents an outbound processing queue with measurable size */
export interface OutboundQueue {
  /** Number of items in the queue */
  readonly size: number
}

/** Sender interface for processing outbound packets */
export interface Sender<T = any> {
  /** Sends data from origin to target */
  readonly send: SendFn<T>
  /** Pauses packet processing */
  readonly stop: () => void
  /** Resumes packet processing */
  readonly resume: () => void
  /** The packets waiting to be sealed */
  readonly queue: OutboundQueue
}

/** Factory function type for creating a Sender instance; `onDrop` receives each packet the sealer rejects */
export type CreateSender<T = any> = (
  label: string,
  sender: SendPacketFn,
  logger: Logger,
  seal: PacketSealer<T>,
  onDrop?: PacketDropHandler
) => Sender<T>

/** Alias for CreateSender factory type */
export type SenderFactory = CreateSender
