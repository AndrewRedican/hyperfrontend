import type { IActionWithContract, IActionWithContractAndSecurity } from '../../types/action'
import type { SecurityNegotiationResponse } from '../../types/security'
import type { ActionDependencies } from './factory'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { ACTION_TYPES } from '../../types/action'

/**
 * Creates ACCEPT_CONNECTION action
 *
 * @param deps - Action dependencies (getBrokerId, getContract)
 * @returns Function that takes processId and optional security response, returns frozen action
 *
 * @example
 * ```typescript
 * // Without security
 * const action = acceptConnection(deps)('process-123')
 *
 * // With security negotiation response
 * const secureAction = acceptConnection(deps)('process-123', {
 *   negotiated: 'v2'
 * })
 * ```
 */
export const acceptConnection =
  (deps: ActionDependencies) =>
  (processId: string, security?: SecurityNegotiationResponse): IActionWithContract | IActionWithContractAndSecurity => {
    const base = <const>{
      type: ACTION_TYPES.ACCEPT_CONNECTION,
      processId,
      senderId: deps.getBrokerId(),
      contract: deps.getContract(),
    }

    if (security) {
      return freeze({ ...base, security })
    }

    return freeze(base)
  }
