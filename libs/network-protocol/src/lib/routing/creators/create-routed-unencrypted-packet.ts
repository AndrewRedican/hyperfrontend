/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Data } from '../../data/model'
import type { RoutedUnencryptedPacket } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createUnencryptedPacket } from '../../packet/creators/create-unencrypted-packet'
import { isValidTopicId } from '../../topic/validations/is-valid-topic-id'

/**
 * Creates a routed unencrypted packet with the specified topic, origin, target, and data.
 * The packet is created using the unencrypted packet creator and frozen.
 *
 * @param topicId - The topic identifier for routing the packet
 * @param origin - The origin URL of the packet sender
 * @param target - The target URL of the packet recipient
 * @param data - The data payload to include in the packet
 * @returns A frozen RoutedUnencryptedPacket
 * @throws {Error} When topic ID validation fails
 *
 * @example
 * ```typescript
 * const routedPacket = createRoutedUnencryptedPacket(
 *   '550e8400-e29b-41d4-a716-446655440000',
 *   'origin-uuid',
 *   'target-uuid',
 *   { message: 'hello' }
 * )
 * // => { topicId: '550e8400-...', packet: { origin, target, data } }
 * ```
 */
export function createRoutedUnencryptedPacket<T = any>(
  topicId: string,
  origin: string,
  target: string,
  data: Data<T>
): RoutedUnencryptedPacket {
  if (!isValidTopicId(topicId)) {
    throw createError('Cannot create a routed unencrypted packet without a valid topic')
  }
  const routedPacket: RoutedUnencryptedPacket<T> = {
    topicId,
    packet: createUnencryptedPacket<T>(origin, target, data),
  }
  return freeze(routedPacket)
}
