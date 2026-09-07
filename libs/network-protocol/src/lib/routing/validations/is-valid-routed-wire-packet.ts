import type { RoutedUnencryptedPacket } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidWirePacket } from '../../packet/validations/is-valid-wire-packet'
import { isValidTopicId } from '../../topic/validations/is-valid-topic-id'

/**
 * Validates whether the provided value is a valid routed wire packet.
 * Checks that the packet has a valid topic ID and wire packet payload.
 *
 * @param routedPacket - The value to validate as a routed wire packet
 * @returns True if the value is a valid routed wire packet, false otherwise
 *
 * @example Validating a routed wire packet
 * ```typescript
 * isValidRoutedWirePacket({ topicId: '550e8400-e29b-41d4-a716-446655440000', packet: wirePacket })
 * // => true
 *
 * isValidRoutedWirePacket({ topicId: 'invalid', packet: null })
 * // => false
 * ```
 */
export function isValidRoutedWirePacket(routedPacket: unknown) {
  const rtp = routedPacket as RoutedUnencryptedPacket
  return getType(rtp) === 'object' && 'topicId' in rtp && 'packet' in rtp && isValidTopicId(rtp.topicId) && isValidWirePacket(rtp.packet)
}
