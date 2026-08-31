/**
 * Schema types for the test executor.
 */
export interface TestExecutorOptions {
  /**
   * Path to the project's test configuration.
   * Defaults to {projectRoot}/test.config.ts.
   */
  testConfig?: string

  /**
   * Where coverage reports are written.
   * Defaults to {workspaceRoot}/coverage/{projectRoot}.
   */
  coverageDirectory?: string
}
