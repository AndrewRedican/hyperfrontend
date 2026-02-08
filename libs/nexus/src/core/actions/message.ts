import { ACTION_TYPES } from '../../types/action'
import type { IActionWithData } from '../../types/action'
import type { ActionDependencies } from './factory'

export const newMessage =
  (deps: ActionDependencies) =>
  (data: unknown): IActionWithData =>
    Object.freeze({
      type: ACTION_TYPES.NEW_MESSAGE,
      senderId: deps.getBrokerId(),
      data,
    })
