import { ACTION_TYPES } from '../../types/action'
import type { IActionWithProcess } from '../../types/action'
import type { ActionDependencies } from './factory'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

export const closeConnection =
  (deps: ActionDependencies) =>
  (processId: string): IActionWithProcess =>
    freeze({
      type: ACTION_TYPES.CLOSE_CONNECTION,
      processId,
      senderId: deps.getBrokerId(),
    })
