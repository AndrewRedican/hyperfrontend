import type { RoutedUnencryptedPacket } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidUnencryptedPacket } from '../../packet/validations/is-valid-unencrypted-packet'
import { isValidTopicId } from '../../topic/validations/is-valid-topic-id'

/**
 * Validates whether the provided value is a valid routed unencrypted packet.
 * Checks that the packet has a valid topic ID and unencrypted packet payload.
 *
 * @param routedPacket - The value to validate as a routed unencrypted packet
 * @returns True if the value is a valid routed unencrypted packet, false otherwise
 *
 * @example Validating a routed unencrypted packet
 * ```typescript
 * isValidRoutedUnencryptedPacket({ topicId: '550e8400-e29b-41d4-a716-446655440000', packet: unencryptedPacket })
 * // => true
 *
 * isValidRoutedUnencryptedPacket({ topicId: 'invalid', packet: null })
 * // => false
 * ```
 */
export function isValidRoutedUnencryptedPacket(routedPacket: unknown) {
  const rtp = <RoutedUnencryptedPacket>routedPacket
  return (
    getType(rtp) === 'object' && 'topicId' in rtp && 'packet' in rtp && isValidTopicId(rtp.topicId) && isValidUnencryptedPacket(rtp.packet)
  )
}
