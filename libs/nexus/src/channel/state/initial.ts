import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import type { ChannelState, IChannelSettings } from '../../types'

/**
 * Creates the initial state for a new channel.
 * All collections are empty, all optional fields are null.
 *
 * @param name - Channel name/identifier
 * @param target - Target window for communication
 * @param settings - Channel settings (queueMessages, debug, etc.)
 * @returns Fresh channel state object
 */
export function createInitialState(name: string, target: Window, settings: Partial<IChannelSettings>): ChannelState {
  return {
    id: uuidV4(),
    name,
    target,
    origin: null,
    active: false,
    connectTimestamp: null,
    contract: settings.contract ?? null,
    acceptedActions: [],
    queuedMessages: [],
    eventSubscriptions: [],
    messageSubscriptions: [],
    scheduledActivation: null,
    queueMessages: settings.queueMessages ?? true,
    debug: settings.debug ?? false,
    brokerManaged: <boolean>(<Record<string, unknown>>settings)['brokerManaged'] ?? false,
    readyToConnect: false,
  }
}
