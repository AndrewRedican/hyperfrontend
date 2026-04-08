import type { IActionBase } from '../../types/action'
import type { ActionDependencies } from './factory'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { ACTION_TYPES } from '../../types/action'

/**
 * Creates a destroy connection action.
 *
 * @param deps - Action dependencies containing broker ID
 * @returns A function that creates a destroy connection action
 */
export const destroyConnection = (deps: ActionDependencies) => (): IActionBase =>
  freeze({
    type: ACTION_TYPES.DESTROY_CONNECTION,
    senderId: deps.getBrokerId(),
  })
