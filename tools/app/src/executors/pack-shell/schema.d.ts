/**
 * Options for the pack-shell executor.
 */
export interface PackShellExecutorOptions {
  /** Directory the packed shell tarball is emitted into. Defaults to dist/{projectRoot}/shell. */
  outputPath?: string
}
