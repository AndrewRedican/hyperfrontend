/**
 * The `version-batch` executor: versions every library a change makes due a release, and records the bumps in one commit.
 *
 * @module @hyperfrontend/workspace/executors/version-batch
 */

export type { VersionBatchResult } from './executor'
export type { VersionBatchExecutorOptions } from './options'
export { versionBatchExecutor, versionBatchExecutor as default } from './executor'
export { baseBranches } from './lib/base-branch'
