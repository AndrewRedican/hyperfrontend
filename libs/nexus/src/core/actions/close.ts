import { ACTION_TYPES } from '../../types/action'
import type { IActionWithProcess } from '../../types/action'
import type { ActionDependencies } from './factory'

export const closeConnection =
  (deps: ActionDependencies) =>
  (processId: string): IActionWithProcess =>
    Object.freeze({
      type: ACTION_TYPES.CLOSE_CONNECTION,
      processId,
      senderId: deps.getBrokerId(),
    })
