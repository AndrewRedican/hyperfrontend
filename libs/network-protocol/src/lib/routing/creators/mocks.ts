import type { Channel } from '../../channel/model'
import type { Topic } from '../../topic/model'
import type { RoutedUnencryptedPacket, RoutedObfuscatedPacket, Subscriptions, Router, RoutingOptions } from '../model'
import { unencryptedPacket, obfuscatedPacket } from '../../packet/creators/mocks'
import { topicId } from '../../topic/creators/mocks'

export const routedUnencryptedPacket: RoutedUnencryptedPacket = {
  topicId,
  packet: unencryptedPacket,
}

export const routedObfuscatedPacket: RoutedObfuscatedPacket = {
  topicId,
  packet: obfuscatedPacket,
}

export const subscriptions: Subscriptions = new WeakMap<Channel, Topic[]>()

export const staticRouting: RoutingOptions = {
  isDynamic: false,
  subscriptions,
}

export const dynamicRouting: RoutingOptions = {
  isDynamic: true,
  subscriptions,
}

export const router: Router = () => staticRouting
