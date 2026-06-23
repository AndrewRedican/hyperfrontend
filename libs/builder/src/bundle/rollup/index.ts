/**
 * Rollup driver: per-format descriptor builders and the per-entry forked-worker
 * dispatcher.
 *
 * @module @hyperfrontend/builder/bundle/rollup
 */
export type { DispatchRollupWorkerOptions, RollupWorkerInvocation } from './dispatch'
export type {
  RollupBuildDescriptor,
  RollupWorkerBin,
  RollupWorkerBundleOutput,
  RollupWorkerFormat,
  RollupWorkerReport,
} from './worker/types'
export { toBinBuildDescriptor, toCjsBuildDescriptor, toEsmBuildDescriptor, toIifeBuildDescriptor, toUmdBuildDescriptor } from './descriptor'
export { dispatchRollupWorker, resolveDefaultRollupWorkerPath } from './dispatch'
export { runRollupWorkerJob } from './worker'
