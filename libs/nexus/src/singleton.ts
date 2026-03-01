/**
 * Default Singleton Broker Instance
 *
 * Provides a ready-to-use broker with sensible defaults for quick prototyping
 * and simple use cases. For production, create your own broker with createBroker().
 */

import { createBroker } from './broker/factory'
import type { BrokerHandle } from './broker/types'
import type { IChannelContract } from './types/contract'

/**
 * Default contract allowing any message type.
 * Useful for development and prototyping.
 */
const DEFAULT_CONTRACT: IChannelContract = {
  emitted: [
    { type: 'MESSAGE', description: 'Generic message' },
    { type: 'DATA', description: 'Generic data transfer' },
    { type: 'EVENT', description: 'Generic event' },
  ],
  accepted: [
    { type: 'MESSAGE', description: 'Generic message' },
    { type: 'DATA', description: 'Generic data transfer' },
    { type: 'EVENT', description: 'Generic event' },
    { type: 'ACK', description: 'Acknowledgment' },
  ],
}

/**
 * Singleton broker instance with sensible defaults.
 *
 * Features:
 * - Generic contract accepting MESSAGE, DATA, EVENT action types
 * - No security restrictions (whitelist/blacklist)
 * - Debug mode off by default
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
export const broker: BrokerHandle = createBroker({
  name: 'default-broker',
  contract: DEFAULT_CONTRACT,
})

/**
 * Export default contract for reference
 */
export { DEFAULT_CONTRACT }
