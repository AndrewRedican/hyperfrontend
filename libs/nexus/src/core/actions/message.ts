import type { IActionWithData } from '../../types/action'
import type { IMessage } from '../../types/message'
import type { ActionDependencies } from './factory'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { ACTION_TYPES } from '../../types/action'

/**
 * Creates a new message action carrying a full user message.
 *
 * The action's `data` field holds the complete message envelope
 * (`type`, optional `data` payload, and any extra properties) so the
 * receiving broker can validate and route it.
 *
 * @param deps - Action dependencies containing broker ID
 * @returns A function that creates a new message action from a user message
 *
 * @example Creating message actions from a user message
 * ```typescript
 * const createMessageAction = newMessage({ getBrokerId: () => 'broker-1' })
 * const action = createMessageAction({ type: 'USER_LOGIN', data: { userId: 123 } })
 * // => {
 * //   type: '[nexus] new-message',
 * //   senderId: 'broker-1',
 * //   data: { type: 'USER_LOGIN', data: { userId: 123 } },
 * // }
 * ```
 */
export const newMessage =
  (deps: ActionDependencies) =>
  (message: IMessage): IActionWithData =>
    freeze({
      type: ACTION_TYPES.NEW_MESSAGE,
      senderId: deps.getBrokerId(),
      data: message,
    })
