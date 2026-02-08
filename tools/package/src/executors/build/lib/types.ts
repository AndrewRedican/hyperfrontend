/**
 * Types and interfaces for the build executor.
 */
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

/** Options for the build executor */
export interface BuildExecutorOptions {
  /** Output directory for the built package */
  outputPath?: string
  /** Path to the TypeScript configuration file */
  tsConfig?: string
  /** Additional assets to copy to the output directory */
  assets?: (string | AssetConfig)[]
  /** External dependencies to exclude from the bundle */
  external?: string[]
  /** Generate self-contained UMD and IIFE bundles for CDN distribution */
  bundle?: boolean
  /** Global variable name for UMD/IIFE bundles (e.g., 'HyperfrontendNexus') */
  globalName?: string
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
  /** The Nx executor context */
  context: ExecutorContext
}
