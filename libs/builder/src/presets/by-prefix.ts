import type { IsWorkspacePackagePredicate } from '../models'

/**
 * Builds an {@link IsWorkspacePackagePredicate} that matches every package whose
 * name starts with the supplied scope.
 *
 * The scope is treated as a literal string prefix: pass the full scope including
 * the trailing slash (`'@hyperfrontend/'`) when matching scoped packages so the
 * predicate doesn't accidentally treat `@hyperfrontend-foo/x` as a workspace
 * package.
 *
 * @param scope - Literal prefix to match against package names.
 * @returns Predicate returning `true` when the supplied name starts with `scope`.
 *
 * @example Matching every workspace package by scope
 * ```typescript
 * const isWorkspacePackage = byPrefix('@hyperfrontend/')
 * isWorkspacePackage('@hyperfrontend/logging') // => true
 * isWorkspacePackage('rollup')                 // => false
 * ```
 */
export const byPrefix = (scope: string): IsWorkspacePackagePredicate => {
  return (name: string): boolean => name.startsWith(scope)
}
