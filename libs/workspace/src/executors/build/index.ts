/**
 * The `build` executor: builds a library into a publishable package with the builder, treating the workspace's own packages as first-party.
 *
 * @module executors/build
 */

export type { BuildExecutorOptions } from './executor'
export { buildExecutor, buildExecutor as default } from './executor'
export { FUNDING_ASSET, rootAssetSpecs } from './root-assets'
