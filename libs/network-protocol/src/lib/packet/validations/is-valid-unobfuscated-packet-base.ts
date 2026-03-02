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
