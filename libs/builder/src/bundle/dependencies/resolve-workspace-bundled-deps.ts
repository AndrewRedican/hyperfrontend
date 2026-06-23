import type { IsWorkspacePackagePredicate, PackageJson, WorkspaceDepHoistPolicy } from '../../models'
import { isAbsolute as nodeIsAbsolute, resolve as nodeResolve } from 'node:path'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists, readJsonFile, readJsonFileIfExists } from '@hyperfrontend/project-scope/core/fs'
import { join, normalizeToForwardSlashes } from '@hyperfrontend/project-scope/core/path'

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
  /** Hoist policy applied to this entry's package; carried through so callers need not re-derive it. */
  policy: WorkspaceDepHoistPolicy
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
  /**
   * Per-package hoist-policy override, keyed by package name. Packages absent
   * from the map default to `'sub-path'` (granular, zero-config). Set a package
   * to `'whole-surface'` to opt into collapsing its sub-paths onto the root
   * chunk. No built-in entries; callers supply their own opinions.
   */
  policy?: Record<string, WorkspaceDepHoistPolicy>
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
 * 3. For each eligible workspace dep, apply the per-dep hoist policy
 *    (`options.policy`, defaulting to `'sub-path'`):
 *    - `'sub-path'` (the zero-config default) emits one entry per resolvable
 *      tsconfig specifier (root + every sub-path with a real source file),
 *      preserving sub-module granularity and supporting subpath-only packages
 *      that expose no root export.
 *    - `'whole-surface'` is an explicit opt-in collapse: it emits a single entry
 *      for the package root, so it requires the dep to expose a root export.
 * 4. The returned list is sorted by `specifier` for stable downstream ordering.
 *
 * Because the caller requested `bundleAllDeps`, an eligible dep that cannot be
 * fully resolved is a contract violation, not a soft skip. The function throws
 * (rather than silently externalising) when an eligible dep has no resolvable
 * tsconfig mapping, when a mapped source has no owning tsconfig, or when a dep
 * is explicitly opted into `'whole-surface'` yet exposes no root export — each
 * with a message naming the dep and the remedy.
 *
 * @param packageJsonPath - Absolute path to the project's `package.json`.
 * @param workspaceRoot - Absolute workspace root used to load `tsconfig.base.json` paths.
 * @param options - Caller overrides + workspace-package predicate + per-package policy map.
 * @returns Resolved workspace-dep pre-pass entries sorted by specifier.
 * @throws {Error} When an eligible workspace dep cannot be bundled (no mapping, no root export under `'whole-surface'`, or no owning tsconfig).
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

  const policyMap = options.policy ?? {}
  // why: granularity is the zero-config default — every public sub-path becomes its own chunk so consumers reuse/tree-shake at sub-module resolution, and subpath-only packages resolve with no configuration. `'whole-surface'` is an explicit opt-in collapse.
  const policyFor = (name: string): WorkspaceDepHoistPolicy => policyMap[name] ?? 'sub-path'

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
    if (matches.length === 0) {
      throw createError(
        `bundleAllDeps: workspace dependency "${packageName}" has no resolvable tsconfig path mapping under ${workspaceRoot} (no matching paths entry, or its mapped source files are missing), so it cannot be bundled. Add a "${packageName}" (or "${packageName}/<sub-path>") entry to tsconfig.base.json paths pointing at an existing source file, or exclude it via bundleAllDeps.exclude.`
      )
    }
    const policy = policyFor(packageName)
    const pushEntry = (specifier: string, inputPath: string): void => {
      const tsConfigPath = resolveTsConfigForPackage(inputPath)
      if (!tsConfigPath) {
        throw createError(
          `bundleAllDeps: workspace dependency "${specifier}" resolves to ${inputPath}, but no tsconfig (tsconfig.lib.json / tsconfig.json) was found in its project root, so it cannot be transformed during bundling.`
        )
      }
      const split = splitSpecifier(specifier)
      results.push({ packageName, subPath: split.subPath, specifier, inputPath, tsConfigPath, policy })
    }
    if (policy === 'whole-surface') {
      const root = matches.find((m) => m.specifier === packageName)
      if (!root) {
        throw createError(
          `bundleAllDeps: workspace dependency "${packageName}" is explicitly set to the 'whole-surface' hoist policy but is subpath-only (no root export; tsconfig exposes only ${matches.map((m) => `"${m.specifier}"`).join(', ')}). Remove the 'whole-surface' override for it (sub-path is the default), or add a root export.`
        )
      }
      pushEntry(root.specifier, root.inputPath)
      continue
    }
    for (const match of matches) pushEntry(match.specifier, match.inputPath)
  }
  return results.sort((a, b) => a.specifier.localeCompare(b.specifier))
}
