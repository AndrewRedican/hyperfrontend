import type { UnobfuscatedPacket } from '../model'
import type { ValidUnobfuscatedPacketBaseResult } from './is-valid-unobfuscated-packet-base.model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidOrigin } from './is-valid-origin'
import { isValidTarget } from './is-valid-target'

export function isValidUnobfuscatedPacketBase(packet: unknown): ValidUnobfuscatedPacketBaseResult {
  const pkt = packet as UnobfuscatedPacket
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
