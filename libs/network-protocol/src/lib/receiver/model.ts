/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@hyperfrontend/logging'
import type { UnencryptedPacket, PacketDeobfuscation, PacketDecryption } from '../packet/model'

export type ReceivePacketFn<T = any> = (packet: UnencryptedPacket<T>) => void

export type ReceiveFn = (packet: Uint8Array) => void

export interface InboundQueue {
  readonly size: number
}

export interface InboundQueues {
  readonly deobfuscationQueue: InboundQueue
  readonly deserializationQueue: InboundQueue
  readonly decryptionQueue: InboundQueue
}

export interface Receiver extends InboundQueues {
  readonly receive: ReceiveFn
  readonly stop: () => void
  readonly resume: () => void
}

export type CreateReceiver<T = any> = (
  label: string,
  receiver: ReceivePacketFn<T>,
  logger: Logger,
  packetDeobfuscation: PacketDeobfuscation,
  packetDecryption: PacketDecryption<T>
) => Receiver

export type ReceiverFactory = CreateReceiver
