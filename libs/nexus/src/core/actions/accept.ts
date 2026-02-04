import { ACTION_TYPES } from '../../types/action'
import type { IActionWithContract } from '../../types/action'
import type { ActionDependencies } from './factory'

export const acceptConnection =
  (deps: ActionDependencies) =>
  (processId: string): IActionWithContract =>
    Object.freeze({
      type: ACTION_TYPES.ACCEPT_CONNECTION,
      processId,
      senderId: deps.getBrokerId(),
      contract: deps.getContract(),
    })
