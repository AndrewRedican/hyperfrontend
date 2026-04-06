/**
 * Options for the lint-report executor.
 */
export interface LintReportExecutorOptions {
  /**
   * Output file path relative to workspace root.
   */
  outputPath?: string

  /**
   * Only lint affected projects instead of all.
   */
  affected?: boolean

  /**
   * Number of files to suggest fixing first (quick wins).
   */
  maxFixes?: number

  /**
   * Return failure if lint errors are found (for CI/hooks).
   */
  failOnError?: boolean
}
