import type { Logger } from '@hyperfrontend/logging'
import type { ActionCreators } from '../../core/actions/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { Registry } from '../../core/registry/factory'
import type { IAction } from '../../types/action'
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
}

/**
 * Handler function signature for routing messages.
 * Receives routing context and message event.
 */
export type RouteHandler = (context: RoutingContext, message: MessageEvent<IAction>) => void
