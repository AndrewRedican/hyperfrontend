/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Data } from '../data/model'

/** Bytes as they travel: a sealed frame carrying one packet */
export type WirePacket = Uint8Array

/** Routing fields every plaintext packet carries */
export interface PacketBase {
  /** Identifies the origin of the packet */
  readonly origin: string
  /** Identifies the intended recipient of the packet */
  readonly target: string
}

/** A packet in the clear: routing fields plus the data envelope */
export interface UnencryptedPacket<T = any> extends PacketBase {
  /** The data envelope */
  readonly data: Data<T>
}

/** A packet at either end of the pipeline */
export type Packet<T = any> = UnencryptedPacket<T> | WirePacket

/** Seals a plaintext packet into wire bytes under the session's sending key */
export type PacketSealer<T = any> = (packet: UnencryptedPacket<T>) => Promise<WirePacket>

/** Opens wire bytes into a plaintext packet under the session's receiving key */
export type PacketOpener<T = any> = (packet: WirePacket) => Promise<UnencryptedPacket<T>>

/** The pipeline stage that rejected a packet */
export type PacketDropStage = 'seal' | 'open'

/** A packet a pipeline stage rejected and the pipeline discarded */
export interface PacketDrop {
  /** Whether the packet was leaving (`outbound`) or arriving (`inbound`) */
  readonly direction: 'inbound' | 'outbound'
  /** The stage that rejected the packet */
  readonly stage: PacketDropStage
  /** Why the stage rejected it */
  readonly reason: string
  /** The error the stage threw, when it threw one */
  readonly cause?: unknown
  /** The packet as the stage received it */
  readonly packet: unknown
}

/** Receives each packet a pipeline discards */
export type PacketDropHandler = (drop: PacketDrop) => void
