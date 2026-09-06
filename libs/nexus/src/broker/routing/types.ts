import type { Logger } from '@hyperfrontend/logging'
import type { ChannelSecurityDependencies } from '../../channel/types'
import type { ActionCreators } from '../../core/actions/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { Registry } from '../../core/registry/factory'
import type { IAction } from '../../types/action'
import type { SecurityProtocolVersion } from '../../types/security'
import type { BrokerState } from '../types'

/**
 * Everything a routing handler needs from the broker.
 */
export interface RoutingContext {
  /** Broker state (id, name, contract, settings, logger) */
  readonly state: BrokerState
  /** Channel registry keyed by window, id, and name */
  readonly registry: Registry
  /** Tracks handshake processes back to their channels */
  readonly processManager: ProcessManager
  /** Action creators stamped with the broker's identity */
  readonly actions: ActionCreators
  /** Broker logger */
  readonly logger: Logger
  /** Returns the protocols the broker can negotiate, most preferred first and 'none' last */
  readonly getSupportedProtocols: () => readonly SecurityProtocolVersion[]
  /** What channels need from the broker to run an encrypted transport */
  readonly security: ChannelSecurityDependencies
}

/**
 * Handler for one action type.
 */
export type RouteHandler = (context: RoutingContext, message: MessageEvent<IAction>) => void
