import type { IsWorkspacePackagePredicate, PackageJson } from '../../models'
import { entries, fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Returns a new `PackageJson` with workspace-internal entries stripped from
 * `dependencies`. `peerDependencies` and `optionalDependencies` are preserved
 * verbatim so consumers retain optional integrations.
 *
 * If filtering empties the `dependencies` map, the field is removed from the
 * returned object instead of left as `{}`.
 *
 * @param pkg - Source `PackageJson` to filter.
 * @param isWorkspacePackage - Predicate returning `true` for workspace-internal packages.
 * @returns Filtered `PackageJson` clone.
 *
 * @example Stripping `@hyperfrontend/*` deps before publishing
 * ```typescript
 * const filtered = filterWorkspaceDepsFromOutput(srcPkg, byPrefix('@hyperfrontend/'))
 * ```
 */
export const filterWorkspaceDepsFromOutput = (pkg: PackageJson, isWorkspacePackage: IsWorkspacePackagePredicate): PackageJson => {
  const next: PackageJson = { ...pkg }
  if (next.dependencies) {
    const externalDeps = entries(next.dependencies).filter(([name]) => !isWorkspacePackage(name))
    if (externalDeps.length > 0) {
      next.dependencies = fromEntries(externalDeps)
    } else {
      delete next.dependencies
    }
  }
  return next
}
