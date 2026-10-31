import type { IsWorkspacePackagePredicate, PackageJson } from '../../models'
import type { ThirdPartyLicenseEntry } from './types'
import { dirname } from 'node:path'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { exists, join, readJsonFile } from '@hyperfrontend/project-scope/core'
import { findOwningProjectRoot, loadWorkspacePathMappings } from '../../bundle/dependencies/resolve-workspace-bundled-deps'
import { readDependencyLicense } from './collect'

const log = logger.channel('builder:package:licenses')

/**
 * Inputs to {@link collectBundledThirdPartyLicenses}.
 */
export interface CollectBundledThirdPartyLicensesOptions {
  /** Absolute workspace root, used to load the tsconfig path mappings that locate workspace packages. */
  workspaceRoot: string
  /** Absolute path to the project being built; its `package.json#dependencies` start the walk. */
  projectRoot: string
  /** Package names that stay external to the output; the walk stops at each of them. */
  external: string[]
  /** Predicate identifying workspace packages, which are walked through but never recorded. */
  isWorkspacePackage: IsWorkspacePackagePredicate
}

// how: Node's own lookup, so a nested install shadows the hoisted copy exactly as the bundler resolves it
const findInstalledPackage = (name: string, fromDir: string): string | undefined => {
  const candidate = join(fromDir, 'node_modules', name)
  if (exists(join(candidate, 'package.json'))) return candidate
  const parent = dirname(fromDir)
  return parent === fromDir ? undefined : findInstalledPackage(name, parent)
}

const findWorkspacePackage = (name: string, mappings: Map<string, string[]>): string | undefined => {
  for (const [specifier, paths] of mappings) {
    if (specifier !== name && !specifier.startsWith(`${name}/`)) continue
    const source = paths.find((path) => exists(path))
    if (source) return findOwningProjectRoot(source)
  }
  return undefined
}

/**
 * Collects a license entry for every third-party package whose code the build
 * inlines into its output.
 *
 * The walk starts from the project's `package.json#dependencies` and follows
 * `dependencies` transitively. A package named in `external` stops the walk,
 * since the consumer installs it with its own license. A workspace package is
 * walked through but not recorded: it is first-party, yet everything it
 * depends on is bundled along with it. Every other package is recorded and its
 * own dependencies are walked, each resolved the way Node resolves it from the
 * package that requires it. Packages that cannot be found are logged at warn
 * level and skipped.
 *
 * The result over-approximates what the bundler kept: a package reached by the
 * walk is listed even when tree-shaking removed all of its code.
 *
 * @param options - Project, workspace and external boundaries for the walk.
 * @returns License entries sorted by package name, one per inlined package.
 *
 * @example Listing the licenses carried by a bundled build
 * ```typescript
 * const entries = collectBundledThirdPartyLicenses({
 *   workspaceRoot: '/abs/repo',
 *   projectRoot: '/abs/repo/libs/features',
 *   external: ['tslib', 'typescript'],
 *   isWorkspacePackage: (name) => name.startsWith('@hyperfrontend/'),
 * })
 * ```
 */
export const collectBundledThirdPartyLicenses = (options: CollectBundledThirdPartyLicensesOptions): ThirdPartyLicenseEntry[] => {
  const external = createSet(options.external)
  const mappings = loadWorkspacePathMappings(options.workspaceRoot)
  const entries = createMap<string, ThirdPartyLicenseEntry>([])
  const visited = createSet<string>([])
  const pending = [options.projectRoot]

  for (let dir = pending.pop(); dir !== undefined; dir = pending.pop()) {
    if (visited.has(dir)) continue
    visited.add(dir)
    const pkg = readJsonFile<PackageJson>(join(dir, 'package.json'))
    for (const dep of keys(pkg.dependencies ?? {})) {
      if (external.has(dep)) continue
      const isWorkspace = options.isWorkspacePackage(dep)
      const depDir = isWorkspace ? findWorkspacePackage(dep, mappings) : findInstalledPackage(dep, dir)
      if (!depDir) {
        log.warn(`could not find package.json for ${dep}`)
        continue
      }
      if (!isWorkspace && !entries.has(dep)) entries.set(dep, readDependencyLicense(dep, depDir))
      pending.push(depDir)
    }
  }

  return from(entries.values()).sort((a, b) => a.name.localeCompare(b.name))
}
