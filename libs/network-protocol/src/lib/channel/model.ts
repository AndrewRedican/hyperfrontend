/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@hyperfrontend/logging'
import type { PacketEncryption, PacketDecryption, PacketObfuscation, PacketDeobfuscation } from '../packet/model'
import type { ReceiveFn, ReceivePacketFn, InboundQueues } from '../receiver/model'
import type { SendFn, SendPacketFn, OutboundQueues } from '../sender/model'

export interface Protocol<T = any> {
  packetEncryption: PacketEncryption<T>
  packetDecryption: PacketDecryption<T>
  packetObfuscation: PacketObfuscation
  packetDeobfuscation: PacketDeobfuscation
  send: SendPacketFn
  receive: ReceivePacketFn<T>
  getLogger: () => Logger
}

export type ProtocolProvider<T = any> = (send: SendPacketFn, receive: ReceivePacketFn<T>) => Protocol<T>

export interface StopResumeControl {
  stop: () => void
  resume: () => void
}

export interface Channel<T = any> extends StopResumeControl {
  readonly label: string
  readonly send: SendFn<T>
  readonly receive: ReceiveFn
  readonly outbound: OutboundQueues & StopResumeControl
  readonly inbound: InboundQueues & StopResumeControl
}

export type ChannelCreater<T = any> = (
  label: string,
  send: SendPacketFn,
  receive: ReceivePacketFn,
  protocol: ProtocolProvider<T>
) => Channel<T>

export interface ChannelEntry<T = any> {
  readonly id: string
  readonly name: string
  readonly channel: Channel<T>
}

export interface ChannelStore<T = any> {
  readonly create: (label: string, send: SendPacketFn, receive: ReceivePacketFn, protocol: ProtocolProvider<T>) => Channel<T>
  readonly add: (...topic: Channel<T>[]) => void
  readonly existsByName: (name: string) => boolean
  readonly existsById: (id: string) => boolean
  readonly removeByName: (...name: string[]) => void
  readonly removeById: (...id: string[]) => void
  readonly clear: () => void
  readonly getByName: (name: string) => Channel<T> | null
  readonly getById: (id: string) => Channel<T> | null
  readonly list: readonly ChannelEntry<T>[]
}
