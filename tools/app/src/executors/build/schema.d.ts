/**
 * Options for the build executor.
 */
export interface BuildExecutorOptions {
  /** Custom build command to run. Defaults to npm run build. */
  command?: string
  /** Output directory for build artifacts. Used for cache outputs. */
  outputPath?: string
}
