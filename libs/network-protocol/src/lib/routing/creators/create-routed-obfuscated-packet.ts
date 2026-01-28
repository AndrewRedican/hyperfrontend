import type { ObfuscatedPacket } from '../../packet/model'
import type { RoutedObfuscatedPacket } from '../model'
import { isValidTopicId } from '../../topic/validations'
import { isValidObfuscatedPacket } from '../../packet/validations'

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
