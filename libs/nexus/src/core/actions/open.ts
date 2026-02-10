import { ACTION_TYPES } from '../../types/action'
import type { IActionWithProcess, IActionWithSecurity } from '../../types/action'
import type { SecurityConfirmation } from '../../types/security'
import type { ActionDependencies } from './factory'

/**
 * Creates OPEN_CONNECTION action
 *
 * @param deps - Action dependencies (getBrokerId, getContract)
 * @returns Function that takes processId and optional security confirmation, returns frozen action
 *
 * @example
 * ```typescript
 * // Without security
 * const action = openConnection(deps)('process-123')
 *
 * // With security confirmation
 * const secureAction = openConnection(deps)('process-123', {
 *   active: true,
 *   protocol: 'v2'
 * })
 * ```
 */
export const openConnection =
  (deps: ActionDependencies) =>
  (processId: string, security?: SecurityConfirmation): IActionWithProcess | (IActionWithProcess & IActionWithSecurity) => {
    const base = {
      type: ACTION_TYPES.OPEN_CONNECTION,
      processId,
      senderId: deps.getBrokerId(),
    } as const

    if (security) {
      return Object.freeze({ ...base, security })
    }

    return Object.freeze(base)
  }
