import type { AssetSpec, IsWorkspacePackagePredicate } from './build-config'
import type { EntryPointDiscovery } from './entry-point'

/**
 * Per-package workspace pre-pass plan element.
 *
 * Resolved by the build phase from `package.json#dependencies` ∩ workspace
 * predicate. The presence of this entry in `BuildContext.workspaceBundledDeps`
 * means the dep gets a hoisted chunk under `_dependencies/<packageName>(/<sub>)?`
 * and consumers route imports through the externalize plugin to that chunk.
 */
export interface WorkspaceBundledDep {
  /** Workspace package name (e.g. `@hyperfrontend/logging`). */
  packageName: string
  /** Sub-path under the package; `''` for the package root. */
  subPath: string
  /** Public import specifier the entry resolves: `<packageName>` or `<packageName>/<subPath>`. */
  specifier: string
  /** Absolute path to the source `.ts` file resolved via tsconfig path mappings. */
  inputPath: string
  /**
   * Absolute path to the dep's own tsconfig (e.g. `tsconfig.lib.json`). The
   * pre-pass worker uses it to drive `@rollup/plugin-typescript` for this dep,
   * keeping each dep's compiler options self-contained instead of inheriting
   * the consumer project's settings.
   */
  tsConfigPath: string
  /** Hoist policy — `'whole-surface'` collapses sub-paths onto the root chunk, `'sub-path'` keeps them separate. */
  policy: 'whole-surface' | 'sub-path'
}

/**
 * Resolved, fully-computed runtime context derived from a `BuildConfig`.
 *
 * Unlike `BuildConfig`, every path and option here has been resolved to an absolute
 * value and every default has been filled in. Builder primitives consume the
 * `BuildContext`, never the raw config.
 */
export interface BuildContext {
  /** Absolute path to the project being built. */
  projectRoot: string
  /** Absolute path to the workspace root. */
  workspaceRoot: string
  /** Project path relative to the workspace root (forward-slash separated). */
  projectRelativePath: string
  /** Resolved absolute output directory. */
  outputPath: string
  /** Resolved absolute path to the project's tsconfig. */
  tsConfigPath: string
  /** Global external dependencies to exclude from every bundle. */
  external: string[]
  /** Asset specs to materialize. */
  assets: AssetSpec[]
  /** Workspace-package predicate, normalized to always-defined. */
  isWorkspacePackage: IsWorkspacePackagePredicate
  /** Result of the entry-point discovery scan. */
  entryPointDiscovery: EntryPointDiscovery
  /**
   * Third-party deps slated for the per-format pre-pass into `_dependencies/<dep>/`.
   *
   * Empty unless at least one format declares `bundleAllDeps`. Threaded through
   * to the bundle, package, and bin phases so each can apply the externalize
   * plugin and strip the deps from the output `package.json`.
   */
  bundledDeps: string[]
  /**
   * Workspace `@hyperfrontend/*` deps slated for the per-format pre-pass into
   * `_dependencies/<packageName>(/<sub>)?/`.
   *
   * Empty unless at least one format declares `bundleAllDeps` and the project
   * declares workspace deps. Threaded through to the bundle phase so workspace
   * pre-pass jobs can be scheduled and the externalize plugin can route
   * workspace imports through the hoisted chunks.
   */
  workspaceBundledDeps: WorkspaceBundledDep[]
  /** Wall-clock timestamp captured at context creation, used for `BuildResult.durationMs`. */
  startedAt: number
}
