import type { IAction } from '../../types/action'
import type { BrokerState } from '../types'
import type { Registry } from '../../core/registry/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { ActionCreators } from '../../core/actions/factory'
import type { ChannelHandle } from '../../types/channel'
import { getById } from '../../core/registry/get-by-id'

/**
 * Handles DESTROY_CONNECTION action
 * Immediately destroys a connection without handshake
 *
 * @param state - Current broker state
 * @param registry - Channel registry for accessing channels
 * @param processManager - Process manager for tracking communication processes
 * @param actions - Action creators for generating responses
 * @param message - Message event containing the DESTROY_CONNECTION action
 *
 * @remarks
 * Side Effects:
 * - Immediately destroys channel (no acknowledgment)
 * - Removes channel from registry
 * - No lifecycle event fired (forceful termination)
 *
 * @example
 * Forceful termination (e.g., window unload):
 * channel.destroy()
 * -> DESTROY_CONNECTION sent
 * -> Remote receives (this handler)
 * -> Channel immediately removed
 */
export function handleDestroy(
  state: BrokerState,
  registry: Registry,
  processManager: ProcessManager,
  actions: ActionCreators,
  message: MessageEvent<IAction>
): void {
  const action = message.data
  const senderId = <string>action.senderId

  // Get channel by sender ID
  const channel = <ChannelHandle>(<unknown>getById(registry, senderId))

  if (!channel) {
    return // Channel not found
  }

  // Destroy channel immediately (without notifying)
  channel.destroy(false)

  // Channel will be removed from registry by its destroy method
}
