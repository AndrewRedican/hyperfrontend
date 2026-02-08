import { ACTION_TYPES } from '../../types/action'
import type { IActionWithProcess } from '../../types/action'
import type { ActionDependencies } from './factory'

export const openConnection =
  (deps: ActionDependencies) =>
  (processId: string): IActionWithProcess =>
    Object.freeze({
      type: ACTION_TYPES.OPEN_CONNECTION,
      processId,
      senderId: deps.getBrokerId(),
    })
