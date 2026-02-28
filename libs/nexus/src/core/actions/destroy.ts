import { ACTION_TYPES } from '../../types/action'
import type { IActionBase } from '../../types/action'
import type { ActionDependencies } from './factory'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

export const destroyConnection = (deps: ActionDependencies) => (): IActionBase =>
  freeze({
    type: ACTION_TYPES.DESTROY_CONNECTION,
    senderId: deps.getBrokerId(),
  })
