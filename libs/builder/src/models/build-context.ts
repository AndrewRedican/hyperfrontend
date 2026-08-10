import type { AssetSpec, IsWorkspacePackagePredicate, WorkspaceDepHoistPolicy } from './build-config'
import type { EntryPointDiscovery } from './entry-point'

/**
 * Per-package workspace dependency to bundle into a hoisted chunk under
 * `_dependencies/<packageName>(/<sub>)?`.
 *
 * The default set is `package.json#dependencies` intersected with the workspace
 * predicate.
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
   * Absolute path to the dep's own tsconfig (e.g. `tsconfig.lib.json`), so the
   * dep is compiled with its own options rather than the consumer project's.
   */
  tsConfigPath: string
  /** Hoist policy for this dep's chunk(s); see {@link WorkspaceDepHoistPolicy}. */
  policy: WorkspaceDepHoistPolicy
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
  /** Whether the declaration pass emits `.d.ts.map` files; absent means it does. */
  declarationMap?: boolean
  /** Global external dependencies to exclude from every bundle. */
  external: string[]
  /** Asset specs to materialize. */
  assets: AssetSpec[]
  /** Workspace-package predicate, normalized to always-defined. */
  isWorkspacePackage: IsWorkspacePackagePredicate
  /** Result of the entry-point discovery scan. */
  entryPointDiscovery: EntryPointDiscovery
  /**
   * Third-party deps bundled into `_dependencies/<dep>/` and stripped from the
   * output `package.json`. Empty unless at least one format declares
   * `bundleAllDeps`.
   */
  bundledDeps: string[]
  /**
   * Workspace deps bundled into `_dependencies/<packageName>(/<sub>)?/`. Empty
   * unless at least one format declares `bundleAllDeps` and the project declares
   * workspace deps.
   */
  workspaceBundledDeps: WorkspaceBundledDep[]
  /** Wall-clock timestamp captured at context creation, used for `BuildResult.durationMs`. */
  startedAt: number
}
