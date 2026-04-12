/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Data } from '../../data/model'
import type { UnencryptedPacket } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isValidUnencryptedData } from '../../data/validations/is-valid-unencrypted-data'
import { withoutValidErrorMessage } from '../utils/without-valid-err-msg'
import { createPacketBase } from './create-packet-base'

/**
 * Creates an unencrypted network packet with validated origin, target, and data.
 * The packet is frozen to prevent modifications after creation.
 *
 * @param origin - The origin URL of the packet sender
 * @param target - The target URL of the packet recipient
 * @param data - The data payload to include in the packet
 * @returns A frozen UnencryptedPacket containing the origin, target, and data
 * @throws {Error} When origin, target, or data validation fails
 *
 * @example Creating an unencrypted packet
 * ```typescript
 * const packet = createUnencryptedPacket(
 *   '550e8400-e29b-41d4-a716-446655440000',
 *   '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
 *   { key: 'session-abc', message: { action: 'ping' } }
 * )
 * // => { origin, target, data: { key, message } }
 * ```
 */
export function createUnencryptedPacket<T = any>(origin: string, target: string, data: Data<T>): UnencryptedPacket<T> {
  const base = createPacketBase(origin, target)
  if (!isValidUnencryptedData(data)) {
    throw createError(withoutValidErrorMessage('data'))
  }
  const packet: UnencryptedPacket = { ...base, data }
  return freeze(packet)
}
