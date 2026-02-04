import type { IAction } from '../../types/action'
import { isActionWithContract } from '../../types/action'
import type { BrokerState } from '../types'
import type { Registry } from '../../core/registry/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { ActionCreators } from '../../core/actions/factory'
import type { ChannelHandle } from '../../types/channel'
import { validateContract } from '../../core/validation/contract'
import { applyPolicy } from '../security/apply-policy'

/**
 * Handles ACCEPT_CONNECTION action
 * Completes connection handshake from the initiator's side
 *
 * @param state - Current broker state
 * @param registry - Channel registry for accessing channels
 * @param processManager - Process manager for tracking communication processes
 * @param actions - Action creators for generating responses
 * @param message - Message event containing the ACCEPT_CONNECTION action
 *
 * @remarks
 * Side Effects:
 * - Activates the channel
 * - Sends OPEN_CONNECTION to complete handshake
 * - Terminates process after activation
 * - Fires 'open' lifecycle event
 *
 * @example
 * Second step of three-way handshake:
 * Initiator <- ACCEPT (this handler) <- Responder
 * Initiator -> OPEN -> Responder
 */
export function handleAccept(
  state: BrokerState,
  registry: Registry,
  processManager: ProcessManager,
  actions: ActionCreators,
  message: MessageEvent<IAction>
): void {
  const action = message.data

  // Type guard to ensure action has contract and processId
  if (!isActionWithContract(action)) {
    return
  }

  const processId = action.processId
  const contract = action.contract

  // Get channel by process ID
  const channel = processManager.get(processId) as ChannelHandle | undefined

  if (!channel) {
    return // Channel not found
  }

  if (channel.isActive()) {
    return // Already open
  }

  // Validate contract
  try {
    validateContract(contract)
  } catch {
    // Invalid contract - cancel connection
    channel.sendAction({
      type: '[nexus] connection-request-cancelled',
      processId,
      senderId: state.id,
    })
    return
  }

  // Apply security policy if configured
  if (state.settings.securityPolicy) {
    const allowed = applyPolicy(state.settings.securityPolicy, message)
    if (!allowed) {
      channel.sendAction({
        type: '[nexus] connection-request-cancelled',
        processId,
        senderId: state.id,
      })
      return
    }
  }

  // Activate channel with connection details
  channel.activate(message.origin, contract)

  // Send OPEN_CONNECTION
  channel.sendAction({
    type: '[nexus] connection-opened',
    processId,
    senderId: state.id,
  })

  // Terminate process (handshake complete)
  processManager.remove(processId)

  // Notify OPENED event
  channel.notifyEvent('open', { origin: message.origin, contract })
}
