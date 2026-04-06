/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@hyperfrontend/logging'
import type { PacketEncryption, PacketDecryption, PacketObfuscation, PacketDeobfuscation } from '../packet/model'
import type { ReceiveFn, ReceivePacketFn, InboundQueues } from '../receiver/model'
import type { SendFn, SendPacketFn, OutboundQueues } from '../sender/model'

/** Protocol instance with encryption, decryption, and message transport */
export interface Protocol<T = any> {
  /** Encrypts packets before sending */
  packetEncryption: PacketEncryption<T>
  /** Decrypts received packets */
  packetDecryption: PacketDecryption<T>
  /** Obfuscates packets for transmission */
  packetObfuscation: PacketObfuscation
  /** Deobfuscates received packets */
  packetDeobfuscation: PacketDeobfuscation
  /** Sends a packet */
  send: SendPacketFn
  /** Receives packets */
  receive: ReceivePacketFn<T>
  /** Returns the logger instance */
  getLogger: () => Logger
}

/** Factory function that creates a protocol from send/receive functions */
export type ProtocolProvider<T = any> = (send: SendPacketFn, receive: ReceivePacketFn<T>) => Protocol<T>

/** Interface for stopping and resuming operations */
export interface StopResumeControl {
  /** Stops the operation */
  stop: () => void
  /** Resumes the operation */
  resume: () => void
}

/** Secure communication channel with inbound and outbound queues */
export interface Channel<T = any> extends StopResumeControl {
  /** Channel label for identification */
  readonly label: string
  /** Sends a message through the channel */
  readonly send: SendFn<T>
  /** Receives messages from the channel */
  readonly receive: ReceiveFn
  /** Outbound message queues */
  readonly outbound: OutboundQueues & StopResumeControl
  /** Inbound message queues */
  readonly inbound: InboundQueues & StopResumeControl
}

/** Factory function for creating channels */
export type ChannelCreater<T = any> = (
  label: string,
  send: SendPacketFn,
  receive: ReceivePacketFn,
  protocol: ProtocolProvider<T>
) => Channel<T>

/** Entry in a channel store with metadata */
export interface ChannelEntry<T = any> {
  /** Unique channel identifier */
  readonly id: string
  /** Channel name */
  readonly name: string
  /** The channel instance */
  readonly channel: Channel<T>
}

/** Store for managing multiple channels */
export interface ChannelStore<T = any> {
  /** Creates and returns a new channel */
  readonly create: (label: string, send: SendPacketFn, receive: ReceivePacketFn, protocol: ProtocolProvider<T>) => Channel<T>
  /** Adds channels to the store */
  readonly add: (...topic: Channel<T>[]) => void
  /** Checks if a channel exists by name */
  readonly existsByName: (name: string) => boolean
  /** Checks if a channel exists by ID */
  readonly existsById: (id: string) => boolean
  /** Removes channels by name */
  readonly removeByName: (...name: string[]) => void
  /** Removes channels by ID */
  readonly removeById: (...id: string[]) => void
  /** Removes all channels */
  readonly clear: () => void
  /** Gets a channel by name */
  readonly getByName: (name: string) => Channel<T> | null
  /** Gets a channel by ID */
  readonly getById: (id: string) => Channel<T> | null
  /** List of all channel entries */
  readonly list: readonly ChannelEntry<T>[]
}
