import type { IsWorkspacePackagePredicate, PackageJson } from '../../models'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists, readJsonFile } from '@hyperfrontend/project-scope/core/fs'

/**
 * Inputs to `resolveExternals`.
 */
export interface ResolveExternalsOptions {
  /** Absolute path to the project's `package.json`. */
  packageJsonPath: string
  /** Additional package names to mark external regardless of the package.json contents. */
  additional?: string[]
  /** Predicate identifying workspace-internal packages. Defaults to "everything is external". */
  isWorkspacePackage?: IsWorkspacePackagePredicate
  /** When `true`, workspace packages are inlined and stripped from the resolved external list. */
  bundleWorkspaceDeps?: boolean
  /**
   * Pre-pass dep set. When non-empty, these are removed from the external list so the
   * externalize plugin can route their imports to `_dependencies/<dep>/` instead.
   */
  bundledDeps?: string[]
}

const readPkg = (packageJsonPath: string): PackageJson => (exists(packageJsonPath) ? readJsonFile<PackageJson>(packageJsonPath) : {})

/**
 * Resolves the external package list for a single bundle.
 *
 * The output combines:
 * - top-level `dependencies` from the project's `package.json`
 * - `peerDependencies` (always external regardless of `bundleWorkspaceDeps`)
 * - the caller-supplied `additional` list
 *
 * When `bundleWorkspaceDeps` is `true` and a workspace predicate is supplied, packages
 * matching the predicate are stripped from `dependencies` and `additional` so they get
 * inlined by the bundler. Peer dependencies are always preserved.
 *
 * @param options - Inputs controlling the resolution.
 * @returns Sorted, de-duplicated list of external package names.
 *
 * @example Resolving externals while inlining workspace deps
 * ```typescript
 * const external = resolveExternals({
 *   packageJsonPath: '/abs/libs/foo/package.json',
 *   isWorkspacePackage: (n) => n.startsWith('@hyperfrontend/'),
 *   bundleWorkspaceDeps: true,
 * })
 * ```
 */
export const resolveExternals = (options: ResolveExternalsOptions): string[] => {
  const pkg = readPkg(options.packageJsonPath)
  const deps = keys(pkg.dependencies ?? {})
  const peerDeps = keys(pkg.peerDependencies ?? {})
  const additional = options.additional ?? []
  const bundledSet = createSet(options.bundledDeps ?? [])
  const inlineWorkspace = options.bundleWorkspaceDeps === true && options.isWorkspacePackage !== undefined

  const filterWorkspace = (names: string[]): string[] =>
    inlineWorkspace ? names.filter((n) => !(<IsWorkspacePackagePredicate>options.isWorkspacePackage)(n)) : names
  const filterBundled = (names: string[]): string[] => (bundledSet.size === 0 ? names : names.filter((n) => !bundledSet.has(n)))

  return from(
    createSet([...filterBundled(filterWorkspace(deps)), ...filterBundled(peerDeps), ...filterBundled(filterWorkspace(additional))])
  )
}
