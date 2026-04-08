import type { IActionWithError } from '../../types/action'
import type { ActionDependencies } from './factory'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { ACTION_TYPES } from '../../types/action'

/**
 * Creates an invalid request action with an error message.
 *
 * @param deps - Action dependencies containing broker ID
 * @returns A function that creates an invalid request action for a process
 *
 * @example
 * ```typescript
 * const createInvalidAction = invalidRequest({ getBrokerId: () => 'broker-1' })
 * const action = createInvalidAction('process-123', 'Malformed payload')
 * // => { type: 'INVALID_REQUEST', processId: 'process-123', senderId: 'broker-1', error: 'Malformed payload' }
 * ```
 */
export const invalidRequest =
  (deps: ActionDependencies) =>
  (processId: string, error: string): IActionWithError =>
    freeze({
      type: ACTION_TYPES.INVALID_REQUEST,
      processId,
      senderId: deps.getBrokerId(),
      error,
    })
