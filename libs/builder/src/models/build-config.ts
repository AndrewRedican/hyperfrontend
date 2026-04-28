import type { PackageJson } from './package-json'

/**
 * Predicate identifying packages that are local to the workspace.
 *
 * Returning `true` opts the package into workspace-aware behavior such as inlining
 * during bundling or stripping from the published `dependencies` map.
 */
export type IsWorkspacePackagePredicate = (name: string) => boolean

/**
 * Predicate gating whether an asset spec materializes for a given package.
 */
export type AssetConditionPredicate = (pkg: PackageJson) => boolean

/**
 * Generic asset-copy specification consumed by the package phase.
 *
 * Either `files` or `glob` selects the inputs under `from`. When neither is provided,
 * every file directly under `from` is copied.
 */
export interface AssetSpec {
  /** Absolute source directory. */
  from: string
  /** Output subdirectory relative to the build's outputPath; use `.` for the dist root. */
  to: string
  /** Explicit relative file names to copy. */
  files?: string[]
  /** POSIX-style glob pattern, evaluated relative to `from`. */
  glob?: string
  /** Predicate gating whether the spec is materialized. */
  condition?: AssetConditionPredicate
}

/**
 * Inheritance specification: copy the listed top-level fields from another package.json
 * onto the synthesized output package.json, leaving existing fields intact.
 */
export interface InheritFromSpec {
  /** Absolute path to the source package.json. */
  from: string
  /** Top-level field names to copy if present on the source. */
  fields: string[]
}

/**
 * Entry-point selection shared by every per-format configuration.
 */
export interface FormatEntryConfig {
  /** Entry pattern(s) — exact path, glob, or list. Omit to include all detected entries. */
  entry?: string | string[]
  /** Pattern(s) to exclude from the resolved entry set. */
  exclude?: string | string[]
}

/**
 * ESM output configuration.
 */
export interface EsmConfig extends FormatEntryConfig {
  /** Generate sourcemaps. Defaults to `true`. */
  sourcemap?: boolean
  /** Additional package names to mark external. */
  external?: string[]
  /** Inline workspace dependencies (`true`) or keep them external (`false`). */
  bundleWorkspaceDeps: boolean
}

/**
 * CommonJS output configuration.
 */
export interface CjsConfig extends FormatEntryConfig {
  /** Generate sourcemaps. Defaults to `true`. */
  sourcemap?: boolean
  /** Additional package names to mark external. */
  external?: string[]
  /** Inline workspace dependencies (`true`) or keep them external (`false`). */
  bundleWorkspaceDeps: boolean
}

/**
 * IIFE (browser self-executing) output configuration.
 */
export interface IifeConfig extends FormatEntryConfig {
  /** Global variable name exposed by the bundle. */
  globalName: string
  /** Emit a minified twin alongside the unminified bundle. Defaults to `true`. */
  minify?: boolean
  /** Output subdirectory relative to outputPath. Defaults to `bundle`. */
  output?: string
  /** Generate sourcemaps. Defaults to `true`. */
  sourcemap?: boolean
  /** Package names to keep external; if omitted, every dependency is inlined. */
  external?: string[]
  /** Global names for each external dependency. Required when `external` is set. */
  globals?: Record<string, string>
}

/**
 * UMD (universal module definition) output configuration.
 */
export interface UmdConfig extends FormatEntryConfig {
  /** Global variable name exposed by the bundle. */
  globalName: string
  /** Emit a minified twin alongside the unminified bundle. Defaults to `true`. */
  minify?: boolean
  /** AMD module identifier. Defaults to the package name. */
  amdId?: string
  /** Output subdirectory relative to outputPath. Defaults to `bundle`. */
  output?: string
  /** Generate sourcemaps. Defaults to `true`. */
  sourcemap?: boolean
  /** Package names to keep external; if omitted, every dependency is inlined. */
  external?: string[]
  /** Global names for each external dependency. Required when `external` is set. */
  globals?: Record<string, string>
}

/**
 * Output formats permitted for a JS bin.
 */
export type BinScriptFormat = 'cjs' | 'esm'

/**
 * Per-bin format declaration: a single format or an explicit list.
 */
export type BinFormatSpec = BinScriptFormat | BinScriptFormat[]

/**
 * Native binary platform identifier in the form `<process.platform>-<process.arch>`.
 */
export type SeaPlatform = 'linux-x64' | 'linux-arm64' | 'darwin-x64' | 'darwin-arm64' | 'win32-x64'

/**
 * Node SEA (single-executable application) configuration for a bin.
 */
export interface SeaConfig {
  /** Platforms for which a native binary should be produced. */
  platforms: SeaPlatform[]
}

/**
 * Bin synthesis configuration.
 *
 * The source file is fixed at `src/bin/<name>.ts`. The runner export defaults to the
 * file's `default` export; override with `runner` to target a named export instead.
 */
export interface BinConfig {
  /** Bin name (also the package.json#bin key and the source file basename). */
  name: string
  /** Required output format(s) for the bin. */
  format: BinFormatSpec
  /** Named runner export to bootstrap. Defaults to the file's `default` export. */
  runner?: string
  /** Override the bootstrap footer template. */
  bootstrap?: string
  /** Opt into Node SEA native binary emission. */
  sea?: SeaConfig
}

/**
 * Memory-monitor configuration thresholds (in MB).
 */
export interface MemoryMonitorOptions {
  /** Heap-used threshold above which a warning is logged. */
  warningMB?: number
  /** Heap-used threshold above which a critical-level message is logged. */
  criticalMB?: number
  /** Step-over-step heap growth threshold above which a growth warning is logged. */
  growthMB?: number
}

/**
 * Top-level builder configuration consumed by the `build()` facade.
 */
export interface BuildConfig {
  /** Absolute path to the project being built. */
  projectRoot: string
  /** Absolute path to the workspace root. */
  workspaceRoot: string
  /** Output directory (absolute, or a template string with `{projectRoot}`). */
  outputPath?: string
  /** Path to the project's tsconfig used for declarations. Defaults to `<projectRoot>/tsconfig.lib.json`. */
  tsConfig?: string
  /** Workspace-package predicate; when omitted the bundler treats every dep as external. */
  isWorkspacePackage?: IsWorkspacePackagePredicate
  /** Drop workspace-internal entries from the output package.json's `dependencies`. */
  filterWorkspaceDepsFromOutput?: boolean
  /** Selectively copy fields from another package.json onto the output package.json. */
  inheritFieldsFrom?: InheritFromSpec
  /** Asset specs to materialize alongside the bundle. */
  assets?: AssetSpec[]
  /** Global externals applied to every format. */
  external?: string[]
  /** ESM configuration; omit to skip ESM output. */
  esm?: EsmConfig | EsmConfig[]
  /** CommonJS configuration; omit to skip CJS output. */
  cjs?: CjsConfig | CjsConfig[]
  /** IIFE bundle configuration; omit to skip IIFE output. */
  iife?: IifeConfig | IifeConfig[]
  /** UMD bundle configuration; omit to skip UMD output. */
  umd?: UmdConfig | UmdConfig[]
  /** Override path for the unpkg field. Defaults to the first UMD bundle path. */
  unpkg?: string
  /** Override path for the jsdelivr field. Defaults to the first UMD bundle path. */
  jsdelivr?: string
  /** Bin declarations to synthesize alongside the library. */
  bin?: BinConfig[]
  /** Emit a third-party-licenses file. */
  thirdPartyLicenses?: boolean
  /** Enable the memory monitor; pass `true` for defaults or an options object for custom thresholds. */
  memoryMonitor?: boolean | MemoryMonitorOptions
  /** Enable verbose / debug logging. */
  verbose?: boolean
}
