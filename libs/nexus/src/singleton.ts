import type { BrokerHandle } from './broker/types'
import type { IChannelContract } from './types/contract'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createBroker } from './broker/factory'

/**
 * Default contract allowing any message type.
 * Useful for development and prototyping.
 */
const DEFAULT_CONTRACT: IChannelContract = freeze(<IChannelContract>{
  emitted: freeze([
    { type: 'MESSAGE', description: 'Generic message' },
    { type: 'DATA', description: 'Generic data transfer' },
    { type: 'EVENT', description: 'Generic event' },
  ]),
  accepted: freeze([
    { type: 'MESSAGE', description: 'Generic message' },
    { type: 'DATA', description: 'Generic data transfer' },
    { type: 'EVENT', description: 'Generic event' },
    { type: 'ACK', description: 'Acknowledgment' },
  ]),
})

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
