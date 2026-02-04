import { ACTION_TYPES } from '../../types/action'
import type { IActionWithError } from '../../types/action'
import type { ActionDependencies } from './factory'

export const denyConnection =
  (deps: ActionDependencies) =>
  (processId: string, error: string): IActionWithError =>
    Object.freeze({
      type: ACTION_TYPES.DENY_CONNECTION,
      processId,
      senderId: deps.getBrokerId(),
      error,
    })
