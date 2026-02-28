import { ACTION_TYPES } from '../../types/action'
import type { IActionWithData } from '../../types/action'
import type { ActionDependencies } from './factory'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

export const newMessage =
  (deps: ActionDependencies) =>
  (data: unknown): IActionWithData =>
    freeze({
      type: ACTION_TYPES.NEW_MESSAGE,
      senderId: deps.getBrokerId(),
      data,
    })
