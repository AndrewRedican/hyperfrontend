/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@hyperfrontend/logging'
import type { PacketDropHandler, PacketOpener, PacketSealer, WirePacket } from '../packet/model'
import type { ReceiveFn, ReceivePacketFn, InboundQueue } from '../receiver/model'
import type { HelloOutcome, ProtocolSession } from '../security/model'
import type { SendFn, SendPacketFn, OutboundQueue } from '../sender/model'

/**
 * The hello exchange that keys a session: each side sends its public material in the clear
 * and accepts the peer's before any frame can be sealed or opened.
 */
export interface HelloExchange {
  /**
   * This side's hello frame: the public material the peer needs to derive the session keys.
   *
   * @returns The frame to transmit, the same bytes on every call
   */
  hello(): Promise<WirePacket>
  /**
   * Tells a hello frame apart from a sealed frame.
   *
   * @param frame - Bytes received from the peer
   * @returns True when the bytes are a hello frame of this protocol
   */
  isHello(frame: WirePacket): boolean
  /**
   * Feeds the peer's hello frame.
   *
   * @param frame - The peer's hello
   * @returns Whether the material was accepted, already known, or rejected
   */
  acceptHello(frame: WirePacket): HelloOutcome
}

/** Protocol instance: the session's seal and open operations, its hello exchange, and the transport callbacks */
export interface Protocol<T = any> extends HelloExchange {
  /** Seals outgoing packets under the session's sending key */
  seal: PacketSealer<T>
  /** Opens incoming frames under the session's receiving key */
  open: PacketOpener<T>
  /** Transmits a sealed frame */
  send: SendPacketFn
  /** Receives an opened packet */
  receive: ReceivePacketFn<T>
  /** Returns the logger instance */
  getLogger: () => Logger
}

/** Factory function that creates a protocol instance for one session from send/receive functions */
export type ProtocolProvider<T = any> = (send: SendPacketFn, receive: ReceivePacketFn<T>, session: ProtocolSession) => Protocol<T>

/** Interface for stopping and resuming operations */
export interface StopResumeControl {
  /** Stops the operation */
  stop: () => void
  /** Resumes the operation */
  resume: () => void
}

/** The outbound side of a channel: its seal queue and its controls */
export interface OutboundPipeline extends StopResumeControl {
  /** The packets waiting to be sealed */
  readonly queue: OutboundQueue
}

/** The inbound side of a channel: its open queue and its controls */
export interface InboundPipeline extends StopResumeControl {
  /** The frames waiting to be opened */
  readonly queue: InboundQueue
}

/** Secure communication channel with an outbound and an inbound pipeline */
export interface Channel<T = any> extends StopResumeControl, HelloExchange {
  /** Channel label for identification */
  readonly label: string
  /** Sends a message through the channel */
  readonly send: SendFn<T>
  /** Receives sealed frames from the channel; hello frames go to `acceptHello` instead */
  readonly receive: ReceiveFn
  /** Outbound pipeline */
  readonly outbound: OutboundPipeline
  /** Inbound pipeline */
  readonly inbound: InboundPipeline
}

/** Everything a channel needs beyond its label */
export interface ChannelOptions<T = any> {
  /** Transmits each sealed frame to the peer */
  readonly send: SendPacketFn
  /** Receives each opened packet */
  readonly receive: ReceivePacketFn<T>
  /** Creates the protocol instance for the session */
  readonly protocolProvider: ProtocolProvider<T>
  /** The negotiated session the protocol instance is bound to */
  readonly session: ProtocolSession
  /** Optional; receives every packet either pipeline discards */
  readonly onDrop?: PacketDropHandler
}

/** Factory function for creating channels */
export type ChannelCreater<T = any> = (label: string, options: ChannelOptions<T>) => Channel<T>

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
  readonly create: (label: string, options: ChannelOptions<T>) => Channel<T>
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
