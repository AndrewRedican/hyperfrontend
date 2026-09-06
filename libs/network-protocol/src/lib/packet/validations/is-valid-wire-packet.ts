import type { WirePacket } from '../model'

/**
 * Checks that a value is a non-empty byte array, the only shape a wire packet takes.
 *
 * @param packet - The value to check
 * @returns True when the value is a `Uint8Array` with at least one byte
 *
 * @example Validating wire packets
 * ```typescript
 * isValidWirePacket(new Uint8Array([1, 2, 3]))
 * // => true
 *
 * isValidWirePacket({ data: 'not binary' })
 * // => false
 * ```
 */
export function isValidWirePacket(packet: unknown): packet is WirePacket {
  return packet instanceof Uint8Array && packet.length > 0
}
