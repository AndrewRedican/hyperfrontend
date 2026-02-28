/**
 * PURPOSE:
 * Creates action creator functions with dependency injection.
 * Returns an object containing all action creators bound to their dependencies.
 *
 * IMPLEMENTATION COMPLETE:
 * - ActionDependencies interface defined
 * - All action creators imported and bound to dependencies
 * - Returns frozen object with all action creators
 */

import type { IChannelContract } from '../../types/contract'
import { requestConnection } from './request'
import { acceptConnection } from './accept'
import { denyConnection } from './deny'
import { cancelConnection } from './cancel'
import { openConnection } from './open'
import { closeConnection } from './close'
import { destroyConnection } from './destroy'
import { newMessage } from './message'
import { invalidRequest } from './invalid'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Dependencies required by action creators
 */
export interface ActionDependencies {
  /** Returns the broker ID that owns these actions */
  getBrokerId: () => string
  /** Returns the channel contract for connection actions */
  getContract: () => IChannelContract
}

/**
 * Creates all action creators bound to the provided dependencies
 *
 * @param deps - Action dependencies (getBrokerId, getContract)
 * @returns Frozen object containing all action creator functions
 *
 * @example
 * ```typescript
 * const actions = createActionCreators({
 *   getBrokerId: () => 'broker-123',
 *   getContract: () => myContract
 * })
 * const action = actions.requestConnection('process-456')
 * ```
 */
export const createActionCreators = (deps: ActionDependencies) =>
  freeze({
    requestConnection: requestConnection(deps),
    acceptConnection: acceptConnection(deps),
    denyConnection: denyConnection(deps),
    cancelConnection: cancelConnection(deps),
    openConnection: openConnection(deps),
    closeConnection: closeConnection(deps),
    destroyConnection: destroyConnection(deps),
    newMessage: newMessage(deps),
    invalidRequest: invalidRequest(deps),
  })

/**
 * Type of the action creators object returned by createActionCreators
 */
export type ActionCreators = ReturnType<typeof createActionCreators>
