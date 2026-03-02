import type { ObfuscatedPacket } from '../../packet/model'
import type { RoutedObfuscatedPacket } from '../model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isValidObfuscatedPacket } from '../../packet/validations/is-valid-obfuscated-packet'
import { isValidTopicId } from '../../topic/validations/is-valid-topic-id'

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
    throw createError('Cannot create a routed obfuscated packet without a valid topic')
  }
  if (!isValidObfuscatedPacket(packet)) {
    throw createError('Cannot create a routed obfuscated packet without a valid obfuscated packet')
  }
  return freeze({
    topicId,
    packet,
  })
}
