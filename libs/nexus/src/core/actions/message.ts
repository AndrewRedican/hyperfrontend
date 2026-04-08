import type { IActionWithData } from '../../types/action'
import type { ActionDependencies } from './factory'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { ACTION_TYPES } from '../../types/action'

/**
 * Creates a new message action with data payload.
 *
 * @param deps - Action dependencies containing broker ID
 * @returns A function that creates a new message action with data
 *
 * @example
 * ```typescript
 * const createMessageAction = newMessage({ getBrokerId: () => 'broker-1' })
 * const action = createMessageAction({ userId: 123, event: 'login' })
 * // => { type: 'NEW_MESSAGE', senderId: 'broker-1', data: { userId: 123, event: 'login' } }
 * ```
 */
export const newMessage =
  (deps: ActionDependencies) =>
  (data: unknown): IActionWithData =>
    freeze({
      type: ACTION_TYPES.NEW_MESSAGE,
      senderId: deps.getBrokerId(),
      data,
    })
