import type { ActionCreators } from '../../core/actions/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { Registry } from '../../core/registry/factory'
import type { BrokerState } from '../types'
import { createChannel } from '../../channel/factory'
import { add as addToRegistry } from '../../core/registry/add'
import { getByWindow } from '../../core/registry/get-by-window'
import { remove as removeFromRegistry } from '../../core/registry/remove'
import { assertNoCircularRef } from '../../utils/validation/assert-no-circular-ref'

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
 *
 * @example Registering a channel with the broker
 * ```typescript
 * const channel = addChannel(
 *   brokerState,
 *   registry,
 *   processManager,
 *   actions,
 *   'widget-channel',
 *   iframe.contentWindow,
 *   { timeout: 5000 }
 * )
 * ```
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
  assertNoCircularRef(settings, 'settings')

  const existing = getByWindow(registry, target)

  if (existing) {
    return <ReturnType<typeof createChannel>>(<unknown>existing)
  }

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
        removeFromRegistry(registry, channel)
      },
    }
  )

  addToRegistry(registry, channel)

  return channel
}
