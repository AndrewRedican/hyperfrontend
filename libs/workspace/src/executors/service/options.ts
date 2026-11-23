/**
 * Options for the service executor.
 */
export interface ServiceExecutorOptions {
  /** Output directory, relative to the workspace root. Defaults to `dist/<project root>`. */
  outputPath?: string
  /** Path to tsconfig, relative to the workspace root. Defaults to `<project root>/tsconfig.lib.json`. */
  tsConfig?: string
  /** Globs relative to the entry module's directory; each match is copied to the same relative path beside the main. */
  assets?: string[]
  /** Enable verbose / debug logging. */
  verbose?: boolean
}
