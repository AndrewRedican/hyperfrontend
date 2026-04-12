import type { IActionWithProcess, IActionWithSecurity } from '../../types/action'
import type { SecurityConfirmation } from '../../types/security'
import type { ActionDependencies } from './factory'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { ACTION_TYPES } from '../../types/action'

/**
 * Creates OPEN_CONNECTION action
 *
 * @param deps - Action dependencies (getBrokerId, getContract)
 * @returns Function that takes processId and optional security confirmation, returns frozen action
 *
 * @example Creating open connection actions
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
    const base = <const>{
      type: ACTION_TYPES.OPEN_CONNECTION,
      processId,
      senderId: deps.getBrokerId(),
    }

    if (security) {
      return freeze({ ...base, security })
    }

    return freeze(base)
  }
