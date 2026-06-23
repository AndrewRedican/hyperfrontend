import type { IsWorkspacePackagePredicate } from '../models'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Builds an {@link IsWorkspacePackagePredicate} that matches an exact list of
 * package names.
 *
 * Use this preset when the workspace exposes packages under heterogeneous scopes
 * (or unscoped names) and a single string prefix can't capture them all.
 *
 * @param names - Exact package names to treat as workspace-internal.
 * @returns Predicate returning `true` when the supplied name appears in `names`.
 *
 * @example Tagging an explicit set of workspace packages
 * ```typescript
 * const isWorkspacePackage = byNames(['@hyperfrontend/logging', 'internal-utils'])
 * isWorkspacePackage('internal-utils')         // => true
 * isWorkspacePackage('rollup')                 // => false
 * ```
 */
export const byNames = (names: string[]): IsWorkspacePackagePredicate => {
  const set = createSet(names)
  return (name: string): boolean => set.has(name)
}
