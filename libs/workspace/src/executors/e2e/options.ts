/**
 * A suite of an e2e project that the built-in formats do not name.
 */
export interface E2eFormatEntry {
  /** The name the run is reported under */
  name: string
  /** The spec files it runs, relative to the test project */
  specs: string[]
  /** Per-test timeout in milliseconds; 30000 when unset */
  timeoutMs?: number
  /** Whether the run needs the DOM preload */
  dom?: boolean
  /** The platforms (`process.platform` values) on which the suites run one at a time */
  serialOn?: string[]
}

/**
 * A format of the e2e target: a built-in name or a suite the project declares.
 */
export type E2eFormat = 'cjs' | 'esm' | 'browser' | E2eFormatEntry

/**
 * Options for the e2e executor.
 */
export interface E2eExecutorOptions {
  /** Path to built package directory relative to workspace root */
  packageDir?: string
  /** Path to E2E test project directory relative to workspace root */
  testDir?: string
  /** Output formats to test */
  formats?: E2eFormat[]
  /** Skip npm pack and install step */
  skipInstall?: boolean
  /** Remove tarball after installation */
  cleanupTarball?: boolean
}
