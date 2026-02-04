import type { IChannelContract } from '../types/contract'

/**
 * Merges multiple channel contracts into a single contract
 *
 * @param contracts - The contracts to merge
 * @returns A single merged contract containing all accepted and provided actions
 *
 * @example
 * ```typescript
 * const contract1 = { accepted: [{ type: 'a' }], provided: [{ type: 'b' }] }
 * const contract2 = { accepted: [{ type: 'c' }], provided: [{ type: 'd' }] }
 * const merged = mergeContracts(contract1, contract2)
 * // merged = { accepted: [{ type: 'a' }, { type: 'c' }], emitted: [{ type: 'b' }, { type: 'd' }] }
 * ```
 */
export function mergeContracts(...contracts: IChannelContract[]): IChannelContract {
  const mergedContract: IChannelContract = {
    accepted: [],
    emitted: [],
  }

  contracts.forEach((contract) => {
    // Only process if contract has the expected properties
    if (!contract || !contract.accepted || !contract.emitted) {
      return
    }

    // Merge accepted actions
    contract.accepted.forEach((action) => {
      const exists = mergedContract.accepted.some((existing) => existing.type === action.type)
      if (!exists) {
        mergedContract.accepted.push(action)
      }
    })

    // Merge emitted actions
    contract.emitted.forEach((action) => {
      const exists = mergedContract.emitted.some((existing) => existing.type === action.type)
      if (!exists) {
        mergedContract.emitted.push(action)
      }
    })
  })

  return mergedContract
}
