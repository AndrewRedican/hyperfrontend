import type { ObfuscatedPacket } from '../../packet/model'
import type { RoutedObfuscatedPacket } from '../model'
import { isValidTopicId } from '../../topic/validations'
import { isValidObfuscatedPacket } from '../../packet/validations'

/**
 * Creates a routed obfuscated packet with the specified topic and packet data.
 * The packet is frozen to prevent modifications after creation.
 *
 * @param topicId - The topic identifier for routing the packet
 * @param packet - The obfuscated packet to route
 * @returns A frozen RoutedObfuscatedPacket
 * @throws {Error} When topic ID or packet validation fails
 */
export function createRoutedObfuscatedPacket(topicId: string, packet: ObfuscatedPacket): RoutedObfuscatedPacket {
  if (!isValidTopicId(topicId)) {
    throw new Error('Cannot create a routed obfuscated packet without a valid topic')
  }
  if (!isValidObfuscatedPacket(packet)) {
    throw new Error('Cannot create a routed obfuscated packet without a valid obfuscated packet')
  }
  return Object.freeze({
    topicId,
    packet,
  })
}
