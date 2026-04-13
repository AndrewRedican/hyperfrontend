import type { UnobfuscatedPacket } from '../model'
import type { ValidUnobfuscatedPacketBaseResult } from './is-valid-unobfuscated-packet-base.model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidOrigin } from './is-valid-origin'
import { isValidTarget } from './is-valid-target'

/**
 * Validates the base structure of an unobfuscated packet.
 * Checks that the packet is an object with valid origin, target, and data properties.
 *
 * @param packet - The value to validate as an unobfuscated packet base
 * @returns An object containing the validation result and the packet cast to UnobfuscatedPacket
 *
 * @example Validating packet base structure
 * ```typescript
 * const { isValid, pkt } = isValidUnobfuscatedPacketBase({
 *   origin: '550e8400-e29b-41d4-a716-446655440000',
 *   target: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
 *   data: { key: 'abc', message: {} }
 * })
 * // => { isValid: true, pkt: { origin, target, data } }
 * ```
 */
export function isValidUnobfuscatedPacketBase(packet: unknown): ValidUnobfuscatedPacketBaseResult {
  const pkt = <UnobfuscatedPacket>packet
  const isValid =
    getType(pkt) === 'object' &&
    'origin' in pkt &&
    'target' in pkt &&
    'data' in pkt &&
    isValidOrigin(pkt.origin) &&
    isValidTarget(pkt.target) &&
    !!pkt.data
  return { isValid, pkt }
}
