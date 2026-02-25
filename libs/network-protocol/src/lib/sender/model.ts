/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@hyperfrontend/logging'
import type { Data } from '../data/model'
import type { PacketEncryption, PacketObfuscation } from '../packet/model'

export type SendPacketFn = (packet: Uint8Array) => void

export type SendFn<T = any> = (origin: string, target: string, data: Data<T>) => void

export interface OutboundQueue {
  size: number
}

export interface OutboundQueues {
  encryptionQueue: OutboundQueue
  serializationQueue: OutboundQueue
  obfuscationQueue: OutboundQueue
}

export interface Sender<T = any> extends OutboundQueues {
  send: SendFn<T>
  stop: () => void
  resume: () => void
}

export type CreateSender<T = any> = (
  label: string,
  sender: SendPacketFn,
  logger: Logger,
  packetEncryption: PacketEncryption<T>,
  packetObfuscation: PacketObfuscation
) => Sender<T>

export type SenderFactory = CreateSender
