import type { IAction, IActionWithContractAndSecurity } from '../../types/action'
import { isActionWithContract } from '../../types/action'
import type { SecurityNegotiationRequest, SecurityProtocolVersion } from '../../types/security'
import type { BrokerState } from '../types'
import type { Registry } from '../../core/registry/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { ActionCreators } from '../../core/actions/factory'
import type { ChannelHandle } from '../../types/channel'
import { getById } from '../../core/registry/get-by-id'
import { addChannel } from '../channels/add'
import { validateContract as validateContractFn } from '../../core/validation/contract'
import { applyPolicy } from '../security/apply-policy'
import { negotiateProtocol, createSecurityResponse } from '../../security/negotiation/negotiate'

/**
 * Default supported security protocols for the responder.
 * Includes 'none' as fallback for backward compatibility.
 */
const DEFAULT_RESPONDER_SUPPORTED: readonly SecurityProtocolVersion[] = ['none']

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
 * - Negotiates security protocol if security data present
 * - Sends ACCEPT_CONNECTION if validation passes
 * - Sends DENY_CONNECTION if contract or security policy fails
 *
 * @example
 * Incoming action triggers:
 * 1. Channel lookup/creation
 * 2. Contract validation
 * 3. Security policy check
 * 4. Security protocol negotiation (if applicable)
 * 5. ACCEPT_CONNECTION response (or DENY if validation fails)
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

  // Extract security request (may be undefined for backward compatibility)
  const securityRequest = (<IActionWithContractAndSecurity>action).security as SecurityNegotiationRequest | undefined

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
      // Send accept immediately (with security response if request was present)
      const securityResponse = securityRequest
        ? createSecurityResponse(negotiateProtocol(securityRequest, DEFAULT_RESPONDER_SUPPORTED).negotiated)
        : undefined

      channel.sendAction({
        type: '[nexus] connection-request-accepted',
        processId,
        senderId: state.id,
        contract: state.contract,
        ...(securityResponse && { security: securityResponse }),
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

  // Store pending security request for later use during acceptance
  if (securityRequest) {
    channel.setPendingSecurityRequest(securityRequest)
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

  // Negotiate security protocol
  let securityResponse = undefined
  if (securityRequest) {
    const result = negotiateProtocol(securityRequest, DEFAULT_RESPONDER_SUPPORTED)
    channel.setNegotiatedProtocol(result.negotiated)
    securityResponse = createSecurityResponse(result.negotiated)

    if (state.settings.debug) {
      console.info(`[nexus] ${state.name} negotiated security protocol: ${result.negotiated}`)
    }
  }

  // Activate channel with connection details
  channel.activate(message.origin, contract)

  // Send acceptance with security response if applicable
  channel.sendAction({
    type: '[nexus] connection-request-accepted',
    processId,
    senderId: state.id,
    contract: state.contract,
    ...(securityResponse && { security: securityResponse }),
  })
}
