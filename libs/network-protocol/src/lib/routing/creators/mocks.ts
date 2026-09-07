import type { Channel } from '../../channel/model'
import type { Topic } from '../../topic/model'
import type { RoutedUnencryptedPacket, RoutedWirePacket, Subscriptions, Router, RoutingOptions } from '../model'
import { createWeakMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map'
import { unencryptedPacket, wirePacket } from '../../packet/creators/mocks'
import { topicId } from '../../topic/creators/mocks'

export const routedUnencryptedPacket: RoutedUnencryptedPacket = {
  topicId,
  packet: unencryptedPacket,
}

export const routedWirePacket: RoutedWirePacket = {
  topicId,
  packet: wirePacket,
}

export const subscriptions: Subscriptions = createWeakMap<Channel, Topic[]>()

export const staticRouting: RoutingOptions = {
  isDynamic: false,
  subscriptions,
}

export const dynamicRouting: RoutingOptions = {
  isDynamic: true,
  subscriptions,
}

/**
 * Mock router that returns static routing options.
 *
 * @returns Static routing configuration
 *
 * @example Using the mock router
 * ```typescript
 * const options = router([], [])
 * // => { isDynamic: false, subscriptions: WeakMap }
 * ```
 */
export const router: Router = () => staticRouting
