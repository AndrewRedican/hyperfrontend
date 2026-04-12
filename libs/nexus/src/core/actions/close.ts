import type { IActionWithProcess } from '../../types/action'
import type { ActionDependencies } from './factory'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { ACTION_TYPES } from '../../types/action'

/**
 * Creates a close connection action.
 *
 * @param deps - Action dependencies containing broker ID
 * @returns A function that creates a close connection action for a process
 *
 * @example Creating close connection actions
 * ```typescript
 * const createCloseAction = closeConnection({ getBrokerId: () => 'broker-1' })
 * const action = createCloseAction('process-123')
 * // => { type: 'CLOSE_CONNECTION', processId: 'process-123', senderId: 'broker-1' }
 * ```
 */
export const closeConnection =
  (deps: ActionDependencies) =>
  (processId: string): IActionWithProcess =>
    freeze({
      type: ACTION_TYPES.CLOSE_CONNECTION,
      processId,
      senderId: deps.getBrokerId(),
    })
