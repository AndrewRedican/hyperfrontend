import type { Logger } from '@hyperfrontend/logging'
import type { IAction } from '../../types/action'
import type { BrokerState } from '../types'
import type { Registry } from '../../core/registry/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { ActionCreators } from '../../core/actions/factory'

/**
 * Context object passed to routing handlers.
 * Provides access to broker state, infrastructure, and logger.
 */
export interface RoutingContext {
  readonly state: BrokerState
  readonly registry: Registry
  readonly processManager: ProcessManager
  readonly actions: ActionCreators
  readonly logger: Logger
}

/**
 * Handler function signature for routing messages.
 * Receives routing context and message event.
 */
export type RouteHandler = (context: RoutingContext, message: MessageEvent<IAction>) => void
