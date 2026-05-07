import type { IsWorkspacePackagePredicate, PackageJson } from '../../models'
import { isAbsolute as nodeIsAbsolute, resolve as nodeResolve } from 'node:path'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists, readJsonFile, readJsonFileIfExists } from '@hyperfrontend/project-scope/core/fs'
import { join, normalizeToForwardSlashes } from '@hyperfrontend/project-scope/core/path'

/**
 * Per-dep hoisting policy. `'sub-path'` pre-passes every tsconfig sub-path for the
 * dep into its own `_dependencies/<name>/<sub>/index.<ext>.js` chunk so per-entry
 * tree-shaking remains sub-module granular. `'whole-surface'` pre-passes only the
 * root entry — every import of the dep, sub-path or otherwise, routes through the
 * single root chunk at runtime.
 *
 * `'sub-path'` is reserved for workspace deps whose root re-exports differ in
 * shape from their sub-path exports; `@hyperfrontend/immutable-api-utils` is the
 * canonical example (root exports namespace objects, sub-paths export named
 * helpers).
 */
export type WorkspaceDepHoistPolicy = 'sub-path' | 'whole-surface'

/**
 * Per-dep policy override map. Workspace packages absent from the table default to `'whole-surface'`.
 */
export const WORKSPACE_DEP_POLICY: Record<string, WorkspaceDepHoistPolicy> = {
  '@hyperfrontend/immutable-api-utils': 'sub-path',
}

const policyFor = (name: string): WorkspaceDepHoistPolicy => WORKSPACE_DEP_POLICY[name] ?? 'whole-surface'

/**
 * Resolved workspace-dep pre-pass entry.
 */
export interface ResolvedWorkspaceDepEntry {
  /** Workspace package name, e.g. `@hyperfrontend/logging`. */
  packageName: string
  /** Sub-path under the package; `''` when the entry is the package root. */
  subPath: string
  /** Public import specifier this entry resolves: `<packageName>` or `<packageName>/<subPath>`. */
  specifier: string
  /** Absolute path to the source file (from tsconfig path-mapping). */
  inputPath: string
  /** Absolute path to the dep's own tsconfig used by `@rollup/plugin-typescript` during pre-pass. */
  tsConfigPath: string
}

/**
 * Inputs to {@link resolveWorkspaceBundledDeps}.
 */
export interface ResolveWorkspaceBundledDepsOptions {
  /** Predicate identifying workspace-internal packages. */
  isWorkspacePackage: IsWorkspacePackagePredicate
  /** Force-include packages even if absent from `package.json#dependencies`. */
  include?: string[]
  /** Skip these packages even if otherwise selected. */
  exclude?: string[]
}

/**
 * Compiler options projection used during tsconfig path resolution.
 */
interface TsConfigCompilerOptionsFragment {
  /** baseUrl interpreted relative to the tsconfig's directory. */
  baseUrl?: string
  /** path-mapping table. Each value is an array of relative paths. */
  paths?: Record<string, string[]>
}

/**
 * Shape of the tsconfig fragments we read for path-mapping resolution.
 */
interface TsConfigFragment {
  /** Path of another tsconfig the current file extends. */
  extends?: string
  /** Compiler options we care about. */
  compilerOptions?: TsConfigCompilerOptionsFragment
}

const readPkg = (packageJsonPath: string): PackageJson => (exists(packageJsonPath) ? readJsonFile<PackageJson>(packageJsonPath) : {})

const dirnameOf = (filePath: string): string => {
  const normalized = normalizeToForwardSlashes(filePath)
  const idx = normalized.lastIndexOf('/')
  return idx <= 0 ? normalized : normalized.slice(0, idx)
}

const absolutize = (relativeTo: string, value: string): string => {
  if (nodeIsAbsolute(value)) return normalizeToForwardSlashes(value)
  return normalizeToForwardSlashes(nodeResolve(relativeTo, value))
}

/**
 * Reads a tsconfig and follows its `extends` chain to merge `compilerOptions.paths`.
 * Later (i.e. inheriting) configs win on key collisions. Each `paths` entry is
 * stored relative to the originating tsconfig's `baseUrl`, which is itself
 * relative to the tsconfig's directory; we absolutize as we go so callers can
 * rely on the returned values being absolute.
 *
 * The function tolerates missing `extends` targets — a typical layout has the
 * project tsconfig extending a workspace-root one, which extends nothing.
 *
 * @param tsconfigPath - Absolute path to the tsconfig to read.
 * @param visited - Set of tsconfig paths already followed (cycle guard).
 * @returns Map keyed by `paths` entry name, with each value an array of absolute candidate paths.
 */
const readTsconfigPaths = (tsconfigPath: string, visited: Set<string> = createSet([])): Map<string, string[]> => {
  const result = createMap<string, string[]>([])
  if (visited.has(tsconfigPath)) return result
  visited.add(tsconfigPath)
  const fragment = readJsonFileIfExists<TsConfigFragment>(tsconfigPath)
  if (!fragment) return result
  if (fragment.extends) {
    const extendsPath = absolutize(dirnameOf(tsconfigPath), fragment.extends)
    const extendsResolved = extendsPath.endsWith('.json') ? extendsPath : `${extendsPath}.json`
    const inherited = readTsconfigPaths(extendsResolved, visited)
    for (const [key, paths] of inherited) result.set(key, paths)
  }
  const localBaseUrl = absolutize(dirnameOf(tsconfigPath), fragment.compilerOptions?.baseUrl ?? '.')
  const localPaths = fragment.compilerOptions?.paths ?? {}
  for (const key of keys(localPaths)) {
    const list = (localPaths[key] ?? []).map((rel) => absolutize(localBaseUrl, rel))
    result.set(key, list)
  }
  return result
}

/**
 * Loads tsconfig path-mappings from a workspace, preferring `tsconfig.base.json`
 * at the workspace root and falling back to a `tsconfig.json` extends chain when
 * the base form is absent.
 *
 * @param workspaceRoot - Absolute workspace root.
 * @returns Map keyed by tsconfig `paths` key (e.g. `@hyperfrontend/logging`),
 * with values pointing at absolute source files.
 *
 * @example Loading the workspace's path-mapping table
 * ```typescript
 * const paths = loadWorkspacePathMappings('/abs/repo')
 * paths.get('@hyperfrontend/logging') // => ['/abs/repo/libs/logging/src/index.ts']
 * ```
 */
export const loadWorkspacePathMappings = (workspaceRoot: string): Map<string, string[]> => {
  const candidates = [join(workspaceRoot, 'tsconfig.base.json'), join(workspaceRoot, 'tsconfig.json')]
  for (const candidate of candidates) {
    if (!exists(candidate)) continue
    const map = readTsconfigPaths(candidate)
    if (map.size > 0) return map
  }
  return createMap([])
}

/**
 * Tuple of (packageName, subPath) split out of a single tsconfig `paths` key.
 */
interface SpecifierSplit {
  /** Workspace package name (e.g. `@hyperfrontend/logging`). */
  packageName: string
  /** Sub-path under the package; `''` when the specifier is the package root. */
  subPath: string
}

/**
 * Specifier-matching entry produced by {@link collectMatchingSpecifiers}.
 */
interface MatchedSpecifierEntry {
  /** Full tsconfig path key (e.g. `@hyperfrontend/logging/sub`). */
  specifier: string
  /** Absolute path to the source file resolved from the tsconfig path entry. */
  inputPath: string
}

/**
 * Splits a tsconfig key like `@hyperfrontend/foo/bar/baz` into the package name
 * (`@hyperfrontend/foo`) and the sub-path (`bar/baz`). Returns `''` for the
 * sub-path when the key is the package root.
 *
 * @param specifier - Tsconfig `paths` key.
 * @returns Split into `packageName` and `subPath`.
 */
const splitSpecifier = (specifier: string): SpecifierSplit => {
  if (specifier.startsWith('@')) {
    const slashAfterScope = specifier.indexOf('/')
    if (slashAfterScope < 0) return { packageName: specifier, subPath: '' }
    const slashAfterName = specifier.indexOf('/', slashAfterScope + 1)
    if (slashAfterName < 0) return { packageName: specifier, subPath: '' }
    return { packageName: specifier.slice(0, slashAfterName), subPath: specifier.slice(slashAfterName + 1) }
  }
  const slash = specifier.indexOf('/')
  if (slash < 0) return { packageName: specifier, subPath: '' }
  return { packageName: specifier.slice(0, slash), subPath: specifier.slice(slash + 1) }
}

const firstResolvable = (paths: string[]): string | undefined => {
  for (const candidate of paths) {
    if (exists(candidate)) return candidate
  }
  return undefined
}

/**
 * Walks parent directories upward from `fromPath` until a `package.json` is
 * found, then returns the directory that owns it. Used to pin a workspace
 * dep's source file back to its own project root so we can locate that dep's
 * tsconfig.
 *
 * @param fromPath - Absolute path to a `.ts` source file inside the dep.
 * @returns The dep's project-root directory, or `undefined` when no `package.json` ancestor exists.
 */
const findOwningProjectRoot = (fromPath: string): string | undefined => {
  const normalized = normalizeToForwardSlashes(fromPath)
  const segments = normalized.split('/').filter((s) => s.length > 0)
  for (let i = segments.length; i > 0; i--) {
    const candidateDir = `/${segments.slice(0, i).join('/')}`
    if (exists(`${candidateDir}/package.json`)) return candidateDir
  }
  return undefined
}

const TSCONFIG_CANDIDATES = ['tsconfig.lib.json', 'tsconfig.json']

/**
 * Locates the tsconfig the typescript plugin should use when transforming a
 * workspace dep's source. Prefers `tsconfig.lib.json` (the build-time config
 * used by the dep itself) and falls back to `tsconfig.json` so non-publishable
 * deps remain compilable.
 *
 * @param projectRoot - Absolute path to the dep's project-root directory.
 * @returns Absolute path to the chosen tsconfig, or `undefined` when none of the candidates exist.
 */
const findDepTsConfig = (projectRoot: string): string | undefined => {
  for (const name of TSCONFIG_CANDIDATES) {
    const candidate = join(projectRoot, name)
    if (exists(candidate)) return candidate
  }
  return undefined
}

const collectMatchingSpecifiers = (packageName: string, mappings: Map<string, string[]>): MatchedSpecifierEntry[] => {
  const matches: MatchedSpecifierEntry[] = []
  for (const [specifier, paths] of mappings) {
    const split = splitSpecifier(specifier)
    if (split.packageName !== packageName) continue
    const inputPath = firstResolvable(paths)
    if (!inputPath) continue
    matches.push({ specifier, inputPath })
  }
  return matches
}

/**
 * Resolves the list of workspace `@hyperfrontend/*` deps that should be hoisted
 * into `_dependencies/<name>(/<sub>)?/index.<ext>.js`.
 *
 * Algorithm:
 * 1. Read the project's `package.json#dependencies`, retain entries matching
 *    `isWorkspacePackage`, and apply caller `include` / `exclude` overrides.
 *    Peer deps and excluded packages are skipped; `include` cannot resurrect a
 *    peer dep.
 * 2. Load workspace path-mappings (tsconfig `paths`).
 * 3. For each workspace dep, apply the per-dep hoist policy:
 *    - `'sub-path'` deps emit one entry per tsconfig sub-path (root + sub-paths
 *      that resolve to a real source file).
 *    - `'whole-surface'` deps emit a single entry for the package root.
 * 4. The returned list is sorted by `specifier` for stable downstream ordering.
 *
 * @param packageJsonPath - Absolute path to the project's `package.json`.
 * @param workspaceRoot - Absolute workspace root used to load `tsconfig.base.json` paths.
 * @param options - Caller overrides + workspace-package predicate.
 * @returns Resolved workspace-dep pre-pass entries sorted by specifier.
 *
 * @example Resolving workspace pre-pass entries for builder
 * ```typescript
 * const entries = resolveWorkspaceBundledDeps(
 *   '/abs/libs/builder/package.json',
 *   '/abs/repo',
 *   { isWorkspacePackage: (n) => n.startsWith('@hyperfrontend/') }
 * )
 * ```
 */
export const resolveWorkspaceBundledDeps = (
  packageJsonPath: string,
  workspaceRoot: string,
  options: ResolveWorkspaceBundledDepsOptions
): ResolvedWorkspaceDepEntry[] => {
  const pkg = readPkg(packageJsonPath)
  const declared = keys(pkg.dependencies ?? {})
  const peerDeps = createSet(keys(pkg.peerDependencies ?? {}))
  const includeSet = createSet(options.include ?? [])
  const excludeSet = createSet(options.exclude ?? [])
  const isWorkspace = options.isWorkspacePackage

  const eligible = declared.filter((name) => isWorkspace(name) && !peerDeps.has(name))
  const merged = createSet([...eligible, ...from(includeSet).filter((name) => isWorkspace(name) && !peerDeps.has(name))])
  const filtered = from(merged).filter((name) => !excludeSet.has(name))
  if (filtered.length === 0) return []

  const mappings = loadWorkspacePathMappings(workspaceRoot)
  const results: ResolvedWorkspaceDepEntry[] = []
  const tsConfigByPackage = createMap<string, string>([])
  const resolveTsConfigForPackage = (inputPath: string): string | undefined => {
    const projectRoot = findOwningProjectRoot(inputPath)
    if (!projectRoot) return undefined
    const cached = tsConfigByPackage.get(projectRoot)
    if (cached) return cached
    const found = findDepTsConfig(projectRoot)
    if (found) tsConfigByPackage.set(projectRoot, found)
    return found
  }
  for (const packageName of filtered) {
    const matches = collectMatchingSpecifiers(packageName, mappings)
    if (matches.length === 0) continue
    const policy = policyFor(packageName)
    const pushEntry = (specifier: string, inputPath: string): void => {
      const tsConfigPath = resolveTsConfigForPackage(inputPath)
      if (!tsConfigPath) return
      const split = splitSpecifier(specifier)
      results.push({ packageName, subPath: split.subPath, specifier, inputPath, tsConfigPath })
    }
    if (policy === 'whole-surface') {
      const root = matches.find((m) => m.specifier === packageName)
      if (!root) continue
      pushEntry(root.specifier, root.inputPath)
      continue
    }
    for (const match of matches) pushEntry(match.specifier, match.inputPath)
  }
  return results.sort((a, b) => a.specifier.localeCompare(b.specifier))
}
