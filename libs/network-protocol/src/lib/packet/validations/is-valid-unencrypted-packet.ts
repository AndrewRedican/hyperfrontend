import type { UnencryptedPacket } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidUnencryptedData } from '../../data/validations/is-valid-unencrypted-data'
import { isValidOrigin } from './is-valid-origin'
import { isValidTarget } from './is-valid-target'

/**
 * Checks that a value is a plaintext packet: a valid origin, a valid target, and a valid
 * data envelope.
 *
 * @param packet - The value to check
 * @returns True when the value has the shape of an `UnencryptedPacket`
 *
 * @example Validating a packet before sealing
 * ```typescript
 * isValidUnencryptedPacket({ origin, target, data: { pid, id, sequence: 1, message: { action: 'ping' }, schema, schemaHash } })
 * // => true
 * ```
 */
export function isValidUnencryptedPacket(packet: unknown): packet is UnencryptedPacket {
  if (getType(packet) !== 'object') {
    return false
  }
  const candidate = packet as UnencryptedPacket
  return isValidOrigin(candidate.origin) && isValidTarget(candidate.target) && isValidUnencryptedData(candidate.data)
}
