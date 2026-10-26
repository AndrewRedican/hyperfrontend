/**
 * The only code that calls Nx: loading a workspace's `@nx/devkit`, running its `nx` headless, and
 * reading the graph Nx computes.
 *
 * @module @hyperfrontend/integration-nx/adapters
 */
export type { DevkitModule, DevkitResolver, LoadDevkitOptions } from './load-devkit'
export type { ReadGraphOptions } from './read-graph'
export type { ExecFile, ExecFileOptions, NxCommandRunner, NxRunnerOptions } from './run-nx'
export { devkitFunction, loadDevkit } from './load-devkit'
export { readNxGraph } from './read-graph'
export { HEADLESS_NX_ENV, nxExecutable, nxRunner, runNxJson } from './run-nx'
