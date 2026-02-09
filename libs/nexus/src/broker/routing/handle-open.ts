import type { IAction } from '../../types/action'
import type { SecurityConfirmation } from '../../types/security'
import type { BrokerState } from '../types'
import type { Registry } from '../../core/registry/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { ActionCreators } from '../../core/actions/factory'
import type { ChannelHandle } from '../../types/channel'

/**
 * Handles OPEN_CONNECTION action
 * Completes handshake on responder's side and notifies open event
 *
 * @param state - Current broker state
 * @param registry - Channel registry for accessing channels
 * @param processManager - Process manager for tracking communication processes
 * @param actions - Action creators for generating responses
 * @param message - Message event containing the OPEN_CONNECTION action
 *
 * @remarks
 * Side Effects:
 * - Terminates the connection process
 * - Extracts security confirmation (if present)
 * - Marks security as ready if security is active
 * - Fires 'open' lifecycle event on responder's side
 * - Fires 'security-ready' event if security transport is active
 *
 * @example
 * Final step of three-way handshake:
 * Responder receives OPEN (this handler) from Initiator
 * Both sides now have active connection
 */
export function handleOpen(
  state: BrokerState,
  registry: Registry,
  processManager: ProcessManager,
  actions: ActionCreators,
  message: MessageEvent<IAction>
): void {
  const action = message.data
  const processId = (action as unknown as Record<string, unknown>)['processId'] as string

  // Extract security confirmation (may be undefined for backward compatibility)
  const securityConfirmation = (action as unknown as Record<string, unknown>)['security'] as SecurityConfirmation | undefined

  // Get channel by process ID
  const channel = processManager.get(processId) as ChannelHandle | undefined

  if (!channel) {
    return // Channel not found
  }

  // Terminate process (handshake complete)
  processManager.remove(processId)

  // Handle security confirmation if present
  if (securityConfirmation) {
    // Store negotiated protocol if not already set
    if (!channel.getNegotiatedProtocol()) {
      channel.setNegotiatedProtocol(securityConfirmation.protocol)
    }

    // Mark security as ready
    channel.setSecurityReady(true)

    if (state.settings.debug) {
      console.info(`[nexus] ${state.name} security ready: protocol=${securityConfirmation.protocol}, active=${securityConfirmation.active}`)
    }

    // Emit security-ready event
    channel.notifyEvent('security-ready', {
      protocol: securityConfirmation.protocol,
      active: securityConfirmation.active,
    })
  } else {
    // No security - mark as ready (passthrough mode)
    channel.setSecurityReady(true)
  }

  // Notify OPENED event to subscribers
  channel.notifyEvent('open', { origin: message.origin })
}
