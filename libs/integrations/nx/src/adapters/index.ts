/**
 * The only code that reaches a workspace's Nx: loading its `@nx/devkit` without a static import.
 *
 * @module @hyperfrontend/integration-nx/adapters
 */
export type { DevkitModule, DevkitResolver, LoadDevkitOptions } from './load-devkit'
export { devkitFunction, loadDevkit } from './load-devkit'
