/**
 * The only code that calls Nx: loading a workspace's `@nx/devkit`, running its `nx` headless, and
 * reading the graph Nx computes.
 *
 * @module @hyperfrontend/integration-nx/adapters
 */
export type { DevkitModule, DevkitResolver, LoadDevkitOptions } from './load-devkit'
export { devkitFunction, loadDevkit } from './load-devkit'
