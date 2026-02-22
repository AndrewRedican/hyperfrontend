import type { ExecutorContext } from '@nx/devkit'

/** Asset configuration for copying files */
export interface AssetConfig {
  /** Input directory (relative to workspace root) */
  input: string
  /** Glob pattern to match files */
  glob: string
  /** Output directory (relative to outputPath) */
  output: string
}

/** Entry point specification for a format */
export interface FormatEntryConfig {
  /**
   * Entry point pattern(s).
   * - Exact: "./browser/v2" or "."
   * - Glob: "./browser/*"
   * - Multiple: ["./browser/v1", "./browser/v2"]
   * - Omit to use all detected entry points
   */
  entry?: string | string[]

  /** Exclude entry points matching these patterns */
  exclude?: string | string[]
}

/** ESM configuration */
export interface ESMConfig extends FormatEntryConfig {
  /** Generate sourcemaps. Defaults to true */
  sourcemap?: boolean

  /** External dependencies (in addition to auto-detected) */
  external?: string[]

  /**
   * Bundle \@hyperfrontend/* workspace dependencies.
   * - true: Workspace packages are inlined/bundled (self-contained output)
   * - false: Workspace packages remain as external imports (npm-style dependencies)
   */
  bundleWorkspaceDeps: boolean
}

/** CJS configuration */
export interface CJSConfig extends FormatEntryConfig {
  /** Generate sourcemaps. Defaults to true */
  sourcemap?: boolean

  /** External dependencies (in addition to auto-detected) */
  external?: string[]

  /**
   * Bundle \@hyperfrontend/* workspace dependencies.
   * - true: Workspace packages are inlined/bundled (self-contained output)
   * - false: Workspace packages remain as external imports (npm-style dependencies)
   */
  bundleWorkspaceDeps: boolean
}

/** IIFE configuration */
export interface IIFEConfig extends FormatEntryConfig {
  /** Global variable name (required) */
  globalName: string

  /** Generate minified version. Defaults to true */
  minify?: boolean

  /** Output subdirectory. Defaults to 'bundle' */
  output?: string

  /** Generate sourcemaps. Defaults to true */
  sourcemap?: boolean

  /** Dependencies to keep external. If omitted, all dependencies are inlined. */
  external?: string[]

  /** Global variable names for external dependencies. Required for each entry in external. */
  globals?: Record<string, string>
}

/** UMD configuration */
export interface UMDConfig extends FormatEntryConfig {
  /** Global variable name (required) */
  globalName: string

  /** Generate minified version. Defaults to true */
  minify?: boolean

  /** AMD module ID. Defaults to package name */
  amdId?: string

  /** Output subdirectory. Defaults to 'bundle' */
  output?: string

  /** Generate sourcemaps. Defaults to true */
  sourcemap?: boolean

  /** Dependencies to keep external. If omitted, all dependencies are inlined. */
  external?: string[]

  /** Global variable names for external dependencies. Required for each entry in external. */
  globals?: Record<string, string>
}

/** Build executor V2 options */
export interface BuildV2ExecutorOptions {
  /** Output directory. Defaults to dist/{projectRoot} */
  outputPath?: string

  /** Path to tsconfig. Defaults to {projectRoot}/tsconfig.lib.json */
  tsConfig?: string

  /** Additional assets to copy */
  assets?: (string | AssetConfig)[]

  /** Global externals for all formats */
  external?: string[]

  /** ESM output. Omit to skip. */
  esm?: ESMConfig | ESMConfig[]

  /** CJS output. Omit to skip. */
  cjs?: CJSConfig | CJSConfig[]

  /** IIFE bundle. Omit to skip. */
  iife?: IIFEConfig | IIFEConfig[]

  /** UMD bundle. Omit to skip. */
  umd?: UMDConfig | UMDConfig[]
}

/**
 * Entry point category - describes the structural pattern of entry points.
 *
 * - 'root': Single entry at src/index.ts (e.g., `@hyperfrontend/random-generator-utils`)
 * - 'platform': Browser/Node split at src/browser/ and src/node/ (e.g., `@hyperfrontend/string-utils`)
 * - 'feature': Multiple feature modules at src/feature/ (e.g., `@hyperfrontend/state-machine`)
 * - 'hybrid': Mix of root, platform, and/or feature entries (e.g., `@hyperfrontend/cryptography`)
 * - 'complex': Nested platform+feature structure (e.g., `@hyperfrontend/network-protocol`)
 */
export type EntryPointCategory = 'root' | 'platform' | 'feature' | 'hybrid' | 'complex'

/**
 * Describes a single entry point within a library.
 */
export interface EntryPoint {
  /** Export path (e.g., '.', './browser', './actions', './browser/channel') */
  exportPath: string
  /** Relative path from src/ to the entry point directory (e.g., '', 'browser', 'actions', 'browser/channel') */
  srcPath: string
  /** Absolute path to the entry file (src/<srcPath>/index.ts) */
  inputFile: string
  /** Whether this is the root entry (src/index.ts) */
  isRoot: boolean
  /** Platform hint if applicable */
  platform?: 'browser' | 'node'
}

/**
 * Result of entry point discovery.
 */
export interface EntryPointDiscovery {
  /** Detected entry point category */
  category: EntryPointCategory
  /** All discovered entry points */
  entryPoints: EntryPoint[]
  /** Whether there's a root entry point (src/index.ts) */
  hasRootEntry: boolean
  /** Platform entry points if any */
  platformEntries: EntryPoint[]
  /** Feature/module entry points if any */
  featureEntries: EntryPoint[]
}

/** Resolved build context with all computed values */
export interface BuildContext {
  /** Absolute path to the project root */
  projectRoot: string
  /** Project path relative to workspace root */
  projectRelativePath: string
  /** Absolute path to the output directory */
  outputPath: string
  /** Absolute path to the tsconfig file */
  tsConfigPath: string
  /** External dependencies to exclude from bundle */
  external: string[]
  /** Assets to copy */
  assets: (string | AssetConfig)[]
  /** Entry point discovery result */
  entryPointDiscovery: EntryPointDiscovery
  /** Absolute path to workspace root */
  workspaceRoot: string
  /** The Nx executor context */
  context: ExecutorContext
}

/** Rollup output format */
export type OutputFormat = 'esm' | 'cjs' | 'iife' | 'umd'

/** Package.json type with standard fields */
export interface PackageJson {
  name?: string
  version?: string
  license?: string
  main?: string
  module?: string
  types?: string
  exports?: Record<string, unknown>
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  repository?: { type: string; url: string } | string
  bugs?: { url: string } | string
  homepage?: string
  author?: { name: string; email?: string; url?: string } | string
  funding?: { type: string; url: string } | string
  sideEffects?: boolean
  unpkg?: string
  jsdelivr?: string
  [key: string]: unknown
}

/** Format outputs collected during build */
export interface FormatOutputs {
  /** ESM entry points built */
  esm: EntryPoint[]
  /** CJS entry points built */
  cjs: EntryPoint[]
  /** IIFE bundles built */
  iife: { config: IIFEConfig; entries: EntryPoint[] }[]
  /** UMD bundles built */
  umd: { config: UMDConfig; entries: EntryPoint[] }[]
}
