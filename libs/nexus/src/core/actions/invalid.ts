import type { IActionWithError } from '../../types/action'
import type { ActionDependencies } from './factory'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { ACTION_TYPES } from '../../types/action'

/**
 * Creates an invalid request action with an error message.
 *
 * @param deps - Action dependencies containing broker ID
 * @returns A function that creates an invalid request action for a process
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
