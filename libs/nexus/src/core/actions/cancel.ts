import type { IActionWithProcess } from '../../types/action'
import type { ActionDependencies } from './factory'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { ACTION_TYPES } from '../../types/action'

/**
 * Creates a cancel connection action.
 *
 * @param deps - Action dependencies containing broker ID
 * @returns A function that creates a cancel connection action for a process
 *
 * @example Creating cancel connection actions
 * ```typescript
 * const createCancelAction = cancelConnection({ getBrokerId: () => 'broker-1' })
 * const action = createCancelAction('process-123')
 * // => { type: 'CANCEL_CONNECTION', processId: 'process-123', senderId: 'broker-1' }
 * ```
 */
export const cancelConnection =
  (deps: ActionDependencies) =>
  (processId: string): IActionWithProcess =>
    freeze({
      type: ACTION_TYPES.CANCEL_CONNECTION,
      processId,
      senderId: deps.getBrokerId(),
    })
