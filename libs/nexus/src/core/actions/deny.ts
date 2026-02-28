import { ACTION_TYPES } from '../../types/action'
import type { IActionWithError } from '../../types/action'
import type { ActionDependencies } from './factory'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

export const denyConnection =
  (deps: ActionDependencies) =>
  (processId: string, error: string): IActionWithError =>
    freeze({
      type: ACTION_TYPES.DENY_CONNECTION,
      processId,
      senderId: deps.getBrokerId(),
      error,
    })
