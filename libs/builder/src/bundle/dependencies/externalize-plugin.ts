/* eslint-disable workspace/no-unsafe-builtin-methods -- worker bootstraps via @swc-node/register before workspace packages are loadable */
import type { Plugin } from 'rollup'
import type { WorkspaceBundledDep } from '../../models'
import { isBuiltin } from 'node:module'
import { relative } from 'node:path'
import { join, normalizeToForwardSlashes } from '../fs/posix-path'

/**
 * Format produced by the rollup invocation that uses the plugin.
 *
 * D.ts passes use `'dts'` so the plugin maps imports to `.d.ts` siblings under
 * `_dependencies/<dep>/`; JS passes use `'esm'` / `'cjs'`.
 */
export type ExternalizeFormat = 'esm' | 'cjs' | 'dts'

const indexFileNameForFormat = (format: ExternalizeFormat): string => {
  if (format === 'esm') return 'index.esm.js'
  if (format === 'cjs') return 'index.cjs.js'
  return 'index.d.ts'
}

/**
 * Computes the relative import specifier that a rollup output at `fromDir`
 * needs to use to reach `toFile`. The result always uses POSIX separators and
 * starts with `./` or `../` so node treats it as a relative path.
 *
 * @param fromDir - Absolute directory containing the output file.
 * @param toFile - Absolute path to the target file.
 * @returns Relative import specifier ready for inclusion in emitted code.
 *
 * @example Computing the relative path to a bundled dep
 * ```typescript
 * relativeImport('/abs/dist/libs/foo/bundle/rollup', '/abs/dist/libs/foo/_dependencies/rollup/index.esm.js')
 * // => '../../_dependencies/rollup/index.esm.js'
 * ```
 */
export const relativeImport = (fromDir: string, toFile: string): string => {
  const raw = relative(fromDir, toFile)
  const normalized = normalizeToForwardSlashes(raw)
  if (normalized.startsWith('.')) return normalized
  return `./${normalized}`
}

const matchesDep = (source: string, dep: string): boolean => source === dep || source.startsWith(`${dep}/`)

/**
 * Per-package workspace-dep routing entry.
 *
 * - `policy: 'whole-surface'` collapses every import of `<packageName>` (root or
 *   sub-path) onto the single root chunk at `_dependencies/<packageName>/index.<ext>`.
 * - `policy: 'sub-path'` matches each pre-passed specifier exactly; non-matched
 *   sub-path imports of the same package fall through unchanged so the rest of
 *   the plugin chain can resolve / inline them.
 */
export interface WorkspaceBundledDepRoute {
  /** Workspace package name (e.g. `@hyperfrontend/logging`). */
  packageName: string
  /** Routing policy applied to imports of this package. */
  policy: 'whole-surface' | 'sub-path'
  /** When `policy === 'sub-path'`: the exact specifiers that were pre-passed. */
  specifiers?: string[]
}

/**
 * Inputs to {@link createExternalizeBundledDepsPlugin}.
 */
export interface ExternalizeBundledDepsPluginOptions {
  /** Bundled-dep package names. Any import of these (or their subpaths) is rerouted to `_dependencies/<dep>/`. */
  deps: string[]
  /** Absolute directory the rollup invocation writes its output to. */
  entryOutDir: string
  /** Format being produced by this rollup invocation. */
  format: ExternalizeFormat
  /** Absolute path to the `_dependencies/` root. */
  depsRoot: string
  /** Workspace bundled-dep routes. Imports of these packages reroute to `_dependencies/<packageName>(/<sub>)?/`. */
  workspaceRoutes?: WorkspaceBundledDepRoute[]
}

/**
 * Resolution shape returned by the externalize-bundled-deps plugin's `resolveId` hook.
 */
interface ExternalResolution {
  /** Resolved import id: relative path under `_dependencies/` or original specifier for builtins. */
  id: string
  /** Always `true`: the plugin only emits external resolutions. */
  external: true
}

/**
 * Resolves a workspace-route match for `source`. Returns `null` when none of
 * the supplied routes own the import; otherwise emits an external resolution
 * pointing at the appropriate `_dependencies/<packageName>(/<sub>)?/index.<ext>`
 * artifact relative to `entryOutDir`.
 *
 * @param source - The import specifier being resolved.
 * @param routes - Workspace bundled-dep routes from {@link buildWorkspaceRoutes}.
 * @param depsRoot - Absolute `_dependencies/` root.
 * @param entryOutDir - Absolute directory the rollup invocation writes to.
 * @param format - Output format being produced (`esm`, `cjs`, or `dts`).
 * @returns External resolution targeting the workspace chunk, or `null`.
 */
const resolveWorkspaceMatch = (
  source: string,
  routes: WorkspaceBundledDepRoute[] | undefined,
  depsRoot: string,
  entryOutDir: string,
  format: ExternalizeFormat
): ExternalResolution | null => {
  if (!routes || routes.length === 0) return null
  for (const route of routes) {
    if (!matchesDep(source, route.packageName)) continue
    if (route.policy === 'whole-surface') {
      const target = join(depsRoot, route.packageName, indexFileNameForFormat(format))
      return { id: relativeImport(entryOutDir, target), external: true }
    }
    const specifiers = route.specifiers ?? []
    for (const specifier of specifiers) {
      if (source !== specifier) continue
      const target = join(depsRoot, specifier, indexFileNameForFormat(format))
      return { id: relativeImport(entryOutDir, target), external: true }
    }
  }
  return null
}

/**
 * Groups `WorkspaceBundledDep` entries into per-package `WorkspaceBundledDepRoute`
 * shapes consumable by {@link createExternalizeBundledDepsPlugin}.
 *
 * Whole-surface deps emit a single route with no specifiers; sub-path deps emit
 * a route enumerating each pre-passed specifier so the plugin can match exactly.
 *
 * @param entries - Workspace bundled-dep entries from `BuildContext.workspaceBundledDeps`.
 * @returns Routes ready to feed into the externalize plugin.
 *
 * @example Building plugin routes from the build context
 * ```typescript
 * const routes = buildWorkspaceRoutes(context.workspaceBundledDeps)
 * createExternalizeBundledDepsPlugin({ deps, entryOutDir, format, depsRoot, workspaceRoutes: routes })
 * ```
 */
export const buildWorkspaceRoutes = (entries: WorkspaceBundledDep[]): WorkspaceBundledDepRoute[] => {
  const byPackage = new Map<string, WorkspaceBundledDepRoute>()
  for (const entry of entries) {
    const existing = byPackage.get(entry.packageName)
    if (entry.policy === 'whole-surface') {
      if (!existing) byPackage.set(entry.packageName, { packageName: entry.packageName, policy: 'whole-surface' })
      continue
    }
    if (existing && existing.policy === 'sub-path') {
      existing.specifiers = [...(existing.specifiers ?? []), entry.specifier]
      continue
    }
    byPackage.set(entry.packageName, { packageName: entry.packageName, policy: 'sub-path', specifiers: [entry.specifier] })
  }
  return [...byPackage.values()]
}

/**
 * Returns a rollup plugin whose `resolveId` hook maps any import of a bundled
 * dep (or its subpath) to a relative import that points at the pre-passed
 * artifact under `_dependencies/<dep>/`. With `workspaceRoutes` populated, the
 * plugin also routes workspace `@hyperfrontend/*` imports through the matching
 * workspace chunk (whole-surface or sub-path mode per route).
 *
 * The plugin marks node builtins (and `node:*` imports) as external so they
 * survive untouched, and returns `null` for everything else so the rest of the
 * plugin chain can resolve normally.
 *
 * @param options - Plugin configuration.
 * @returns Rollup plugin.
 *
 * @example Routing imports of `rollup` to the pre-passed copy
 * ```typescript
 * const plugin = createExternalizeBundledDepsPlugin({
 *   deps: ['rollup'],
 *   entryOutDir: '/abs/dist/libs/foo/bundle/rollup',
 *   format: 'esm',
 *   depsRoot: '/abs/dist/libs/foo/_dependencies',
 * })
 * ```
 */
export const createExternalizeBundledDepsPlugin = (options: ExternalizeBundledDepsPluginOptions): Plugin => {
  const { deps, entryOutDir, format, depsRoot, workspaceRoutes } = options
  return {
    name: 'externalize-bundled-deps',
    /**
     * Rollup `resolveId` hook for the externalize plugin.
     *
     * @param source - The import specifier being resolved.
     * @returns External resolution targeting the matching `_dependencies/` chunk, or `null`.
     */
    resolveId(source: string): ExternalResolution | null {
      if (source.startsWith('node:') || isBuiltin(source)) {
        return { id: source, external: true }
      }
      const workspaceMatch = resolveWorkspaceMatch(source, workspaceRoutes, depsRoot, entryOutDir, format)
      if (workspaceMatch) return workspaceMatch
      for (const dep of deps) {
        if (!matchesDep(source, dep)) continue
        const target = join(depsRoot, dep, indexFileNameForFormat(format))
        const id = relativeImport(entryOutDir, target)
        return { id, external: true }
      }
      return null
    },
  }
}
