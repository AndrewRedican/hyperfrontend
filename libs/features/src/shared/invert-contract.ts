import type { ActionDescription, FeatureContract } from './types'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/**
 * Deep-copies an action list so the returned contract shares no object
 * references with its source.
 *
 * @param actions - The action descriptions to copy.
 * @returns Fresh action objects with identical contents.
 */
function copyActions(actions: ActionDescription[]): ActionDescription[] {
  // why: The messaging layer rejects configs containing repeated object references, so the inverted contract must be built from fresh literals rather than aliasing the caller's action objects.
  return actions.map((action) => <ActionDescription>parse(stringify(action)))
}

/**
 * Inverts a feature-authored contract into the host's perspective.
 *
 * A feature contract is written from the feature's point of view: `emitted` is
 * what the feature sends, `accepted` is what the feature handles. The host
 * channel needs the mirror image — it sends what the feature accepts and
 * accepts what the feature emits — so the two lists are swapped. The contract
 * `version` is direction-free and carries through unchanged, so the host
 * announces the contract cut baked into its shell.
 *
 * @param contract - The contract as authored by the feature.
 * @returns A fresh contract oriented to the host side.
 *
 * @example Deriving the host-side contract
 * ```typescript
 * const host = invertFeatureContract({ emitted: [{ type: 'tick' }], accepted: [{ type: 'setTimezone' }] })
 * // => { emitted: [{ type: 'setTimezone' }], accepted: [{ type: 'tick' }] }
 * ```
 */
export function invertFeatureContract(contract: FeatureContract): FeatureContract {
  return {
    emitted: copyActions(contract.accepted),
    accepted: copyActions(contract.emitted),
    ...(contract.version !== undefined && { version: contract.version }),
  }
}
