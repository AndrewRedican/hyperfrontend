import type { IsWorkspacePackagePredicate, PackageJson } from '../../models'
import { entries, fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

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

/**
 * Returns a new `PackageJson` with bundled-dep entries stripped from `dependencies`.
 *
 * When the dist contains pre-passed copies under `_dependencies/<dep>/`, those packages
 * are no longer transitive runtime requirements — consumers get them inside the tarball.
 * Removing them from the published `dependencies` field keeps the manifest honest.
 *
 * If filtering empties the `dependencies` map, the field is removed entirely.
 *
 * @param pkg - Source `PackageJson` to filter.
 * @param bundledDeps - Bundled-dep package names (typically `BuildContext.bundledDeps`).
 * @returns Filtered `PackageJson` clone.
 *
 * @example Stripping bundled deps from the published dependencies map
 * ```typescript
 * const filtered = filterBundledDepsFromOutput(srcPkg, ['rollup', 'postject'])
 * ```
 */
export const filterBundledDepsFromOutput = (pkg: PackageJson, bundledDeps: string[]): PackageJson => {
  if (bundledDeps.length === 0) return pkg
  const next: PackageJson = { ...pkg }
  if (next.dependencies) {
    const bundled = createSet(bundledDeps)
    const remaining = entries(next.dependencies).filter(([name]) => !bundled.has(name))
    if (remaining.length > 0) {
      next.dependencies = fromEntries(remaining)
    } else {
      delete next.dependencies
    }
  }
  return next
}
