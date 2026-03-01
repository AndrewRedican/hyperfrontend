import type { ActionCreators } from '../../core/actions/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { Registry } from '../../core/registry/factory'
import type { BrokerState } from '../types'
import { createChannel } from '../../channel/factory'
import { add as addToRegistry } from '../../core/registry/add'
import { getByWindow } from '../../core/registry/get-by-window'
import { remove as removeFromRegistry } from '../../core/registry/remove'

/**
 * Adds a channel to the broker.
 *
 * @param state - Current broker state
 * @param registry - Channel registry for storing and retrieving channels
 * @param processManager - Process ID manager for tracking communication processes
 * @param actions - Action creators from broker for managing channel lifecycle
 * @param name - Unique identifier for the channel
 * @param target - Target window to communicate with
 * @param settings - Optional configuration settings for the channel
 * @returns The created or existing channel
 */
export function addChannel(
  state: BrokerState,
  registry: Registry,
  processManager: ProcessManager,
  actions: ActionCreators,
  name: string,
  target: Window,
  settings: Record<string, unknown> = {}
): ReturnType<typeof createChannel> {
  // Check if channel already exists for this window
  const existing = getByWindow(registry, target)

  if (existing) {
    // If names differ, we'd need to update (for now, cast and return existing)
    // In full implementation, might call renameChannel here
    // Cast to ChannelHandle since the registry stores full channel objects
    return existing as unknown as ReturnType<typeof createChannel>
  }

  // Create new channel with broker's contract and logger
  const channel = createChannel(
    {
      name,
      target,
      settings: {
        ...settings,
        contract: state.contract,
        logger: state.logger,
        brokerManaged: true,
      },
    },
    {
      actions,
      processManager,
      cleanup: () => {
        // Remove from registry when channel is destroyed
        removeFromRegistry(registry, channel)
      },
    }
  )

  // Add to registry
  addToRegistry(registry, channel)

  return channel
}
