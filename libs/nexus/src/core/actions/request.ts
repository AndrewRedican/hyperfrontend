import type { IActionWithContract, IActionWithContractAndSecurity } from '../../types/action'
import type { SecurityNegotiationRequest } from '../../types/security'
import type { ActionDependencies } from './factory'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { ACTION_TYPES } from '../../types/action'

/**
 * Creates REQUEST_CONNECTION action
 *
 * @param deps - Action dependencies (getBrokerId, getContract)
 * @returns Function that takes processId and optional security request, returns frozen action
 *
 * @example
 * ```typescript
 * // Without security
 * const action = requestConnection(deps)('process-123')
 *
 * // With security negotiation
 * const secureAction = requestConnection(deps)('process-123', {
 *   supported: ['v2', 'v1', 'none'],
 *   preferred: 'v2'
 * })
 * ```
 */
export const requestConnection =
  (deps: ActionDependencies) =>
  (processId: string, security?: SecurityNegotiationRequest): IActionWithContract | IActionWithContractAndSecurity => {
    const base = {
      type: ACTION_TYPES.REQUEST_CONNECTION,
      processId,
      senderId: deps.getBrokerId(),
      contract: deps.getContract(),
    } as const

    if (security) {
      return freeze({ ...base, security })
    }

    return freeze(base)
  }
