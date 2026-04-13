import type { IActionWithError } from '../../types/action'
import type { ActionDependencies } from './factory'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { ACTION_TYPES } from '../../types/action'

/**
 * Creates a deny connection action with an error message.
 *
 * @param deps - Action dependencies containing broker ID
 * @returns A function that creates a deny connection action for a process
 *
 * @example Creating deny connection actions
 * ```typescript
 * const createDenyAction = denyConnection({ getBrokerId: () => 'broker-1' })
 * const action = createDenyAction('process-123', 'Origin not allowed')
 * // => { type: 'DENY_CONNECTION', processId: 'process-123', senderId: 'broker-1', error: 'Origin not allowed' }
 * ```
 */
export const denyConnection =
  (deps: ActionDependencies) =>
  (processId: string, error: string): IActionWithError =>
    freeze({
      type: ACTION_TYPES.DENY_CONNECTION,
      processId,
      senderId: deps.getBrokerId(),
      error,
    })
