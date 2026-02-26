/**
 * Options for the e2e executor.
 */
export interface E2eExecutorOptions {
  /** Path to built package directory relative to workspace root */
  packageDir?: string
  /** Path to E2E test project directory relative to workspace root */
  testDir?: string
  /** Output formats to test */
  formats?: ('cjs' | 'esm' | 'iife' | 'umd' | 'browser')[]
  /** Skip npm pack and install step */
  skipInstall?: boolean
  /** Remove tarball after installation */
  cleanupTarball?: boolean
}
