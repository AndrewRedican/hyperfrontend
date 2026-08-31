import type { RoutedUnencryptedPacket } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidObfuscatedPacket } from '../../packet/validations/is-valid-obfuscated-packet'
import { isValidTopicId } from '../../topic/validations/is-valid-topic-id'

/**
 * Validates whether the provided value is a valid routed obfuscated packet.
 * Checks that the packet has a valid topic ID and obfuscated packet payload.
 *
 * @param routedPacket - The value to validate as a routed obfuscated packet
 * @returns True if the value is a valid routed obfuscated packet, false otherwise
 *
 * @example Validating a routed obfuscated packet
 * ```typescript
 * isValidRoutedObfuscatedPacket({ topicId: '550e8400-e29b-41d4-a716-446655440000', packet: obfuscatedPacket })
 * // => true
 *
 * isValidRoutedObfuscatedPacket({ topicId: 'invalid', packet: null })
 * // => false
 * ```
 */
export function isValidRoutedObfuscatedPacket(routedPacket: unknown) {
  const rtp = routedPacket as RoutedUnencryptedPacket
  return (
    getType(rtp) === 'object' && 'topicId' in rtp && 'packet' in rtp && isValidTopicId(rtp.topicId) && isValidObfuscatedPacket(rtp.packet)
  )
}
