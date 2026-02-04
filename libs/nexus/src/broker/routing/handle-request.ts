import type { IAction } from '../../types/action'
import { isActionWithContract } from '../../types/action'
import type { BrokerState } from '../types'
import type { Registry } from '../../core/registry/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { ActionCreators } from '../../core/actions/factory'
import type { ChannelHandle } from '../../types/channel'
import { getById } from '../../core/registry/get-by-id'
import { addChannel } from '../channels/add'
import { validateContract as validateContractFn } from '../../core/validation/contract'
import { applyPolicy } from '../security/apply-policy'

/**
 * Handles REQUEST_CONNECTION action
 * Creates or retrieves channel and initiates connection handshake
 *
 * @param state - Current broker state
 * @param registry - Channel registry for accessing channels
 * @param processManager - Process manager for tracking communication processes
 * @param actions - Action creators for generating responses
 * @param message - Message event containing the REQUEST_CONNECTION action
 *
 * @remarks
 * Side Effects:
 * - Creates new channel if not found in registry
 * - Tracks process ID for handshake completion
 * - Sends ACCEPT_CONNECTION if validation passes
 * - Sends DENY_CONNECTION if contract or security policy fails
 *
 * @example
 * Incoming action triggers:
 * 1. Channel lookup/creation
 * 2. Contract validation
 * 3. Security policy check
 * 4. ACCEPT_CONNECTION response (or DENY if validation fails)
 */
export function handleRequest(
  state: BrokerState,
  registry: Registry,
  processManager: ProcessManager,
  actions: ActionCreators,
  message: MessageEvent<IAction>
): void {
  const action = message.data
  const senderId = <string>action.senderId

  // Use type guards to safely access action properties
  if (!isActionWithContract(action)) {
    return // Invalid action structure
  }

  const processId = action.processId
  const contract = action.contract

  // Get existing channel by ID or create new one
  let channel = getById(registry, senderId) as ChannelHandle | undefined
  if (!channel) {
    channel = addChannel(state, registry, processManager, actions, senderId, <Window>message.source, {})
  }

  // Track this process - associate processId with channel for later lookup
  processManager.create(channel)

  // If channel is already open and sender matches
  if (channel.isActive()) {
    if (senderId === channel.id) {
      // Send accept immediately
      channel.sendAction({
        type: '[nexus] connection-request-accepted',
        processId,
        senderId: state.id,
        contract: state.contract,
      })
    } else {
      // Page reloaded - log if debug
      if (state.settings.debug) {
        console.info(`[nexus] ${state.name} detected channel [${channel.getName()}] reloaded.`)
      }
    }
    return
  }

  // Validate contract
  try {
    validateContractFn(contract)
  } catch {
    // Invalid contract - deny and terminate
    channel.sendAction({
      type: '[nexus] connection-request-denied',
      processId,
      senderId: state.id,
      error: 'Invalid contract.',
    })
    processManager.remove(processId)
    return
  }

  // Apply security policy if configured
  if (state.settings.securityPolicy) {
    const allowed = applyPolicy(state.settings.securityPolicy, message)
    if (!allowed) {
      channel.sendAction({
        type: '[nexus] connection-request-denied',
        processId,
        senderId: state.id,
        error: 'Not accepted.',
      })
      processManager.remove(processId)
      return
    }
  }

  // Check if channel is ready to connect (i.e., connect() has been called)
  if (!channel.isReadyToConnect()) {
    // Schedule activation for when connect() is called
    channel.scheduleActivation(senderId, message.origin, contract, processId)

    if (state.settings.debug) {
      console.info(`[nexus] ${state.name} scheduled activation for channel ${channel.getName()}`)
    }
    return
  }

  // Activate channel with connection details
  channel.activate(message.origin, contract)

  // Send acceptance
  channel.sendAction({
    type: '[nexus] connection-request-accepted',
    processId,
    senderId: state.id,
    contract: state.contract,
  })
}
