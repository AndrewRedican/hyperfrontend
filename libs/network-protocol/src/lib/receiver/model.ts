/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@hyperfrontend/logging'
import type { UnencryptedPacket, PacketDeobfuscation, PacketDecryption } from '../packet/model'

export type ReceivePacketFn<T = any> = (packet: UnencryptedPacket<T>) => void

export type ReceiveFn = (packet: Uint8Array) => void

export interface InboundQueue {
  size: number
}

export interface InboundQueues {
  deobfuscationQueue: InboundQueue
  deserializationQueue: InboundQueue
  decryptionQueue: InboundQueue
}

export interface Receiver extends InboundQueues {
  receive: ReceiveFn
  stop: () => void
  resume: () => void
}

export type CreateReceiver<T = any> = (
  label: string,
  receiver: ReceivePacketFn<T>,
  logger: Logger,
  packetDeobfuscation: PacketDeobfuscation,
  packetDecryption: PacketDecryption<T>
) => Receiver

export type ReceiverFactory = CreateReceiver
