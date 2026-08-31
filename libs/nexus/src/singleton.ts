import type { BrokerHandle } from './broker/types'
import { get, has, ownKeys, getOwnPropertyDescriptor } from '@hyperfrontend/immutable-api-utils/built-in-copy/reflect'
import { createBroker } from './broker/factory'
import { DEFAULT_CONTRACT } from './constants/default-contract'

// why: memoization slot so repeated access always yields the same broker instance
let instance: BrokerHandle | null = null

/**
 * Returns the memoized default broker, creating it on first use.
 *
 * @returns The default broker instance
 */
function resolveBroker(): BrokerHandle {
  if (!instance) {
    instance = createBroker({
      name: 'default-broker',
      contract: DEFAULT_CONTRACT,
    })
  }
  return instance
}

/**
 * Singleton broker instance with sensible defaults.
 *
 * Features:
 * - Generic contract accepting MESSAGE, DATA, EVENT action types
 * - No security restrictions (whitelist/blacklist)
 * - Debug mode off by default
 *
 * The underlying broker is created lazily on first property access, so
 * importing this module is safe in non-browser environments; using the
 * broker outside a browser throws a descriptive error instead.
 *
 * @example
 * ```typescript
 * import { broker } from '@hyperfrontend/nexus'
 *
 * // Create a channel
 * const channel = broker.addChannel('my-channel', targetWindow)
 * channel.connect()
 * channel.send('MESSAGE', { hello: 'world' })
 * ```
 */
export const broker: BrokerHandle = new Proxy({} as Record<string | symbol, unknown>, {
  get: (_target, property) => get(resolveBroker(), property),
  has: (_target, property) => has(resolveBroker(), property),
  ownKeys: () => ownKeys(resolveBroker()),
  getOwnPropertyDescriptor: (_target, property) => {
    const descriptor = getOwnPropertyDescriptor(resolveBroker(), property)
    // why: the proxy target holds no own properties, so descriptors must be reported configurable to satisfy proxy invariants
    return descriptor ? { ...descriptor, configurable: true } : undefined
  },
}) as unknown as BrokerHandle

/**
 * Export default contract for reference
 */
export { DEFAULT_CONTRACT }
