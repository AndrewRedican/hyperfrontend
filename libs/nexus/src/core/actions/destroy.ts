import { ACTION_TYPES } from '../../types/action'
import type { IActionBase } from '../../types/action'
import type { ActionDependencies } from './factory'

export const destroyConnection = (deps: ActionDependencies) => (): IActionBase =>
  Object.freeze({
    type: ACTION_TYPES.DESTROY_CONNECTION,
    senderId: deps.getBrokerId(),
  })
