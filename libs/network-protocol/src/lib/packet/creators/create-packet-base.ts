import type { PacketBase } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { withoutValidErrorMessage } from '../utils/without-valid-err-msg'
import { isValidOrigin } from '../validations/is-valid-origin'
import { isValidTarget } from '../validations/is-valid-target'

/**
 * Creates the base structure for a network packet with origin and target.
 * Validates origin and target URLs before creating the frozen packet base.
 *
 * @param origin - The origin URL of the packet sender
 * @param target - The target URL of the packet recipient
 * @returns A frozen PacketBase object with validated origin and target
 * @throws {Error} When origin or target validation fails
 *
 * @example Creating a packet base
 * ```typescript
 * const base = createPacketBase(
 *   '550e8400-e29b-41d4-a716-446655440000',
 *   '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
 * )
 * // => { origin: '550e8400-...', target: '6ba7b810-...' }
 * ```
 */
export function createPacketBase(origin: string, target: string): PacketBase {
  if (!isValidOrigin(origin)) {
    throw createError(withoutValidErrorMessage('origin'))
  }
  if (!isValidTarget(target)) {
    throw createError(withoutValidErrorMessage('target'))
  }
  const packetBase: PacketBase = { origin, target }
  return freeze(packetBase)
}
