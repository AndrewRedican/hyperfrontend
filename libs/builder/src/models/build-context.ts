import type { AssetSpec, IsWorkspacePackagePredicate } from './build-config'
import type { EntryPointDiscovery } from './entry-point'

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
  /** Wall-clock timestamp captured at context creation, used for `BuildResult.durationMs`. */
  startedAt: number
}
