import type { ActionCreators } from '../../core/actions/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { Registry } from '../../core/registry/factory'
import type { ChannelSecuritySettings } from '../../types/security'
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
 * @remarks
 * When a channel already exists for the target window (e.g. auto-created by
 * an inbound connection request), that channel is returned and any security
 * settings passed here are applied to it unless it already has some.
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
    const existingChannel = existing as unknown as ReturnType<typeof createChannel>
    const security = settings['security'] as ChannelSecuritySettings | undefined
    // why: An inbound request may auto-create the channel before the app registers it; the app's security settings (fail-closed included) must still take effect.
    if (security) {
      existingChannel.applySecuritySettings(security)
    }
    return existingChannel
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
