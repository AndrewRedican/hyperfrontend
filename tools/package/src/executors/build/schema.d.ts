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
