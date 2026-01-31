import type { RoutedUnencryptedPacket } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidTopicId } from '../../topic/validations'
import { isValidObfuscatedPacket } from '../../packet/validations'

/**
 * Validates whether the provided value is a valid routed obfuscated packet.
 * Checks that the packet has a valid topic ID and obfuscated packet payload.
 *
 * @param routedPacket - The value to validate as a routed obfuscated packet
 * @returns True if the value is a valid routed obfuscated packet, false otherwise
 */
export function isValidRoutedObfuscatedPacket(routedPacket: unknown) {
  const rtp = routedPacket as RoutedUnencryptedPacket
  return (
    getType(rtp) === 'object' && 'topicId' in rtp && 'packet' in rtp && isValidTopicId(rtp.topicId) && isValidObfuscatedPacket(rtp.packet)
  )
}
