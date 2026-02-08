import { ACTION_TYPES } from '../../types/action'
import type { IActionWithContract } from '../../types/action'
import type { ActionDependencies } from './factory'

/**
 * Creates REQUEST_CONNECTION action
 *
 * @param deps - Action dependencies (getBrokerId, getContract)
 * @returns Function that takes processId and returns frozen action
 */
export const requestConnection =
  (deps: ActionDependencies) =>
  (processId: string): IActionWithContract =>
    Object.freeze({
      type: ACTION_TYPES.REQUEST_CONNECTION,
      processId,
      senderId: deps.getBrokerId(),
      contract: deps.getContract(),
    })
