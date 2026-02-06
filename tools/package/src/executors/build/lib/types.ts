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
}

/** Library type detection result */
export type LibraryType = 'standard' | 'isomorphic'

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
  /** Detected library type */
  libraryType: LibraryType
  /** The Nx executor context */
  context: ExecutorContext
}
