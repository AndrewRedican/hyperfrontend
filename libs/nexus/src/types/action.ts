import type { IChannelContract } from './contract'
import type { SecurityNegotiationRequest, SecurityNegotiationResponse, SecurityConfirmation } from './security'

/**
 * Protocol prefix for all action types.
 * This is the Nexus protocol identifier.
 */
const PROTOCOL = 'nexus'

/**
 * Action type string literals for the Nexus protocol.
 *
 * These define the wire format for all connection lifecycle actions.
 * The connection flow behavior is 1:1 with the proven legacy implementation.
 */
export const ACTION_TYPES = {
  INVALID_REQUEST: `[${PROTOCOL}] invalid-request`,
  REQUEST_CONNECTION: `[${PROTOCOL}] connection-request`,
  CANCEL_CONNECTION: `[${PROTOCOL}] connection-request-cancelled`,
  CANCEL_CONNECTION_ACKNOWLEDGED: `[${PROTOCOL}] connection-request-cancelled-acknowledged`,
  ACCEPT_CONNECTION: `[${PROTOCOL}] connection-request-accepted`,
  DENY_CONNECTION: `[${PROTOCOL}] connection-request-denied`,
  CLOSE_CONNECTION: `[${PROTOCOL}] connection-closed`,
  CLOSE_CONNECTION_ACKNOWLEDGED: `[${PROTOCOL}] connection-closed-acknowledged`,
  DESTROY_CONNECTION: `[${PROTOCOL}] connection-destroyed`,
  OPEN_CONNECTION: `[${PROTOCOL}] connection-opened`,
  NEW_MESSAGE: `[${PROTOCOL}] new-message`,
} as const

/**
 * Extract action type union from ACTION_TYPES
 */
export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES]

/**
 * Base action interface - all actions extend this
 */
export interface IActionBase {
  /** The type of action being performed */
  readonly type: ActionType
  /** Broker ID that sent this action */
  readonly senderId: string
  /** Optional security negotiation/confirmation data */
  readonly security?: SecurityNegotiationRequest | SecurityNegotiationResponse | SecurityConfirmation
}

/**
 * Action with process ID (most connection lifecycle actions)
 */
export interface IActionWithProcess extends IActionBase {
  /** Unique identifier for the connection process */
  readonly processId: string
}

/**
 * Action with contract (REQUEST_CONNECTION, ACCEPT_CONNECTION)
 */
export interface IActionWithContract extends IActionWithProcess {
  /** Channel contract defining accepted and emitted actions */
  readonly contract: IChannelContract
}

/**
 * Action with contract and security negotiation request.
 * Used for REQUEST_CONNECTION with security.
 */
export interface IActionWithContractAndSecurity extends IActionWithContract {
  /** Optional security negotiation request data */
  readonly security?: SecurityNegotiationRequest
}

/**
 * Action with security data.
 * Used for handshake actions that carry security negotiation/confirmation.
 */
export interface IActionWithSecurity extends IActionBase {
  /** Optional security negotiation or confirmation data */
  readonly security?: SecurityNegotiationRequest | SecurityNegotiationResponse | SecurityConfirmation
}

/**
 * Action with error/reason (INVALID_REQUEST, DENY_CONNECTION)
 */
export interface IActionWithError extends IActionWithProcess {
  /** Error message describing what went wrong */
  readonly error: string
  /** Machine-readable denial reason (e.g. 'security-unavailable') */
  readonly reason?: string
}

/**
 * Action with message data (NEW_MESSAGE)
 */
export interface IActionWithData extends IActionBase {
  /** The message payload data */
  readonly data: unknown
}

/**
 * Union type representing all possible action structures
 */
export type IAction = IActionWithContract | IActionWithError | IActionWithData | IActionWithProcess | IActionBase

/**
 * Type guards for specific action types
 *
 * @param action - The action to check
 * @returns True if action contains a contract property
 *
 * @example Checking for contract property
 * ```typescript
 * if (isActionWithContract(action)) {
 *   console.log(action.contract)
 * }
 * ```
 */
export const isActionWithContract = (action: IAction): action is IActionWithContract => 'contract' in action

/**
 * Type guard for actions with error property
 *
 * @param action - The action to check
 * @returns True if action contains an error property
 *
 * @example Checking for error property
 * ```typescript
 * if (isActionWithError(action)) {
 *   console.error(action.error)
 * }
 * ```
 */
export const isActionWithError = (action: IAction): action is IActionWithError => 'error' in action

/**
 * Type guard for actions with data property.
 *
 * @param action - The action to check
 * @returns True if action contains a data property
 *
 * @example Checking for data property
 * ```typescript
 * if (isActionWithData(action)) {
 *   processData(action.data)
 * }
 * ```
 */
export const isActionWithData = (action: IAction): action is IActionWithData => 'data' in action

/**
 * Type guard for actions with processId property.
 *
 * @param action - The action to check
 * @returns True if action contains a processId property
 *
 * @example Checking for processId property
 * ```typescript
 * if (isActionWithProcess(action)) {
 *   trackProcess(action.processId)
 * }
 * ```
 */
export const isActionWithProcess = (action: IAction): action is IActionWithProcess => 'processId' in action
