import type { IsWorkspacePackagePredicate, PackageJson } from '../../models'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists, readJsonFile } from '@hyperfrontend/project-scope/core/fs'

/**
 * Packages that are never eligible for bundling, regardless of how they're
 * declared or what overrides the caller supplies.
 *
 * `typescript` is the lone permanent entry: it is a consumer requirement of
 * every `@hyperfrontend/builder` project, far too large to inline, and its
 * monolithic `lib/typescript.d.ts` defeats `rollup-plugin-dts`. The framework
 * refuses to bundle it so this invariant cannot be undone by configuration.
 */
const ALWAYS_EXCLUDED = createSet(['typescript'])

/**
 * Inputs to {@link resolveBundledDeps}.
 */
export interface ResolveBundledDepsOptions {
  /** Predicate identifying workspace-internal packages; when matched, packages are NOT pre-passed. */
  isWorkspacePackage?: IsWorkspacePackagePredicate
  /** Force-include packages even if absent from `package.json#dependencies`. */
  include?: string[]
  /** Skip these packages even if otherwise selected. */
  exclude?: string[]
}

const readPkg = (packageJsonPath: string): PackageJson => (exists(packageJsonPath) ? readJsonFile<PackageJson>(packageJsonPath) : {})

/**
 * Resolves the list of third-party dependencies that should be pre-passed
 * (bundled once into `_dependencies/<dep>/`) for the build.
 *
 * Algorithm (per Decision #40):
 * 1. Read `dependencies` from the project's `package.json`.
 * 2. Subtract `peerDependencies` — those stay external.
 * 3. Subtract anything matching `isWorkspacePackage` — workspace deps are inlined per the existing flow.
 * 4. Apply `include` / `exclude` overrides.
 *
 * The returned list is sorted and de-duplicated.
 *
 * @param packageJsonPath - Absolute path to the project's `package.json`.
 * @param options - Caller overrides.
 * @returns Sorted list of third-party package names to pre-pass.
 *
 * @example Resolving bundled deps for a workspace library
 * ```typescript
 * const deps = resolveBundledDeps('/abs/libs/foo/package.json', {
 *   isWorkspacePackage: (n) => n.startsWith('@hyperfrontend/'),
 * })
 * ```
 */
export const resolveBundledDeps = (packageJsonPath: string, options: ResolveBundledDepsOptions = {}): string[] => {
  const pkg = readPkg(packageJsonPath)
  const deps = keys(pkg.dependencies ?? {})
  const peerDeps = createSet(keys(pkg.peerDependencies ?? {}))
  const isWorkspace = options.isWorkspacePackage ?? ((): boolean => false)
  const includeSet = createSet(options.include ?? [])
  const excludeSet = createSet(options.exclude ?? [])

  const eligible = deps.filter((name) => !peerDeps.has(name) && !isWorkspace(name) && !ALWAYS_EXCLUDED.has(name))
  const merged = createSet([...eligible, ...includeSet])
  const filtered = from(merged).filter(
    (name) => !excludeSet.has(name) && !peerDeps.has(name) && !isWorkspace(name) && !ALWAYS_EXCLUDED.has(name)
  )
  return filtered.sort()
}
