import type { Logger } from '@hyperfrontend/logging'
import type { ActionCreators } from '../../core/actions/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { Registry } from '../../core/registry/factory'
import type { IAction } from '../../types/action'
import type { SecurityProtocolVersion } from '../../types/security'
import type { BrokerState } from '../types'

/**
 * Context object passed to routing handlers.
 * Provides access to broker state, infrastructure, and logger.
 */
export interface RoutingContext {
  /** Current broker state snapshot */
  readonly state: BrokerState
  /** Process registry for window/process lookup */
  readonly registry: Registry
  /** Manager for process lifecycle operations */
  readonly processManager: ProcessManager
  /** Factory for creating broker actions */
  readonly actions: ActionCreators
  /** Scoped logger for routing operations */
  readonly logger: Logger
  /** Returns the security protocols the broker can negotiate, sourced from its protocol registry */
  readonly getSupportedProtocols: () => readonly SecurityProtocolVersion[]
  /** Looks up the provider registered for a protocol (undefined for 'none' or unregistered identifiers) */
  readonly getProtocol: (id: SecurityProtocolVersion) => unknown
  /** Routes an action through the broker's handler map, exactly as one arriving over the wire */
  readonly routeAction: (event: MessageEvent<IAction>) => void
}

/**
 * Handler function signature for routing messages.
 * Receives routing context and message event.
 */
export type RouteHandler = (context: RoutingContext, message: MessageEvent<IAction>) => void
