import type { WirePacket } from '../../packet/model'
import type { RoutedWirePacket } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isValidWirePacket } from '../../packet/validations/is-valid-wire-packet'
import { isValidTopicId } from '../../topic/validations/is-valid-topic-id'

/**
 * Creates a routed wire packet with the specified topic and packet data.
 * The packet is frozen to prevent modifications after creation.
 *
 * @param topicId - The topic identifier for routing the packet
 * @param packet - The wire packet to route
 * @returns A frozen RoutedWirePacket
 * @throws {Error} When topic ID or packet validation fails
 *
 * @example Creating a routed wire packet
 * ```typescript
 * const routedPacket = createRoutedWirePacket(
 *   '550e8400-e29b-41d4-a716-446655440000',
 *   wirePacket
 * )
 * // => { topicId: '550e8400-...', packet: wirePacket }
 * ```
 */
export function createRoutedWirePacket(topicId: string, packet: WirePacket): RoutedWirePacket {
  if (!isValidTopicId(topicId)) {
    throw createError('Cannot create a routed wire packet without a valid topic')
  }
  if (!isValidWirePacket(packet)) {
    throw createError('Cannot create a routed wire packet without a valid wire packet')
  }
  return freeze({
    topicId,
    packet,
  })
}
