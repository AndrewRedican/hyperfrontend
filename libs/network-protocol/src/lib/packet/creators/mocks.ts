import type { PacketOpener, PacketSealer, UnencryptedPacket, WirePacket } from '../model'
import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'
import { data } from '../../data/creators/mocks'

/** Origin uuid the mock packets are stamped with */
export const origin = '550e8400-e29b-41d4-a716-446655440000'

/** Target uuid the mock packets are stamped with */
export const target = '641c7fcb-d7dd-4a18-ab50-ce797192ed82'

/** A valid plaintext packet wrapping the canonical data envelope */
export const unencryptedPacket: UnencryptedPacket = { origin, target, data }

/** The bytes the mock sealer emits for every packet */
export const wirePacket: WirePacket = createUint8Array([3, 0, 0, 0, 0, 0, 0, 0, 1, 42, 42, 42, 42])

/**
 * A sealer that ignores its input and emits the mock wire bytes.
 *
 * @returns The mock wire packet
 *
 * @example Standing in for a session's sealer
 * ```typescript
 * await packetSealer(unencryptedPacket) // => wirePacket
 * ```
 */
export const packetSealer: PacketSealer = async () => wirePacket

/**
 * An opener that ignores its input and yields the mock plaintext packet.
 *
 * @returns The mock plaintext packet
 *
 * @example Standing in for a session's opener
 * ```typescript
 * await packetOpener(wirePacket) // => unencryptedPacket
 * ```
 */
export const packetOpener: PacketOpener = async () => unencryptedPacket
