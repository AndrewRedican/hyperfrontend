/**
 * Rollup driver: plugin factories, per-format configuration builders, the
 * sequential `executeRollup` runner, and the per-entry forked-worker dispatcher.
 *
 * @module @hyperfrontend/builder/bundle/rollup
 */
export type { DispatchRollupWorkerOptions, RollupWorkerInvocation } from './dispatch'
export type { BundleTypescriptPluginOptions, TypescriptPluginOptions } from './plugins'
export type { RollupBuildDescriptor, RollupWorkerBundleOutput, RollupWorkerFormat, RollupWorkerReport } from './worker/types'
export { createCjsConfig, createCjsEntryConfig } from './config-cjs'
export { createEsmConfig, createEsmEntryConfig } from './config-esm'
export { createIifeConfig, createIifeEntryConfig } from './config-iife'
export { createUmdConfig, createUmdEntryConfig } from './config-umd'
export { toCjsBuildDescriptor, toEsmBuildDescriptor, toIifeBuildDescriptor, toUmdBuildDescriptor } from './descriptor'
export { dispatchRollupWorker, resolveDefaultRollupWorkerPath } from './dispatch'
export { executeRollup } from './execute'
export {
  createBrowserNodeResolvePlugin,
  createBundleTypescriptPlugin,
  createCommonJsPlugin,
  createJsonPlugin,
  createNodeResolvePlugin,
  createTerserPlugin,
  createTypescriptPlugin,
} from './plugins'
export { runRollupWorkerJob } from './worker'
