/**
 * The `version` executor: versions a project from its conventional commits, pins its dependents to the new version, and commits the bump.
 *
 * @module executors/version
 */

export type { FollowUp, FollowUpRun, RunVersionOptions, RunVersionResult, VersionBump } from './lib/run-version-for-project'
export type { VersionExecutorOptions } from './options'
export { versionExecutor, versionExecutor as default } from './executor'
export { runVersion } from './lib/run-version-for-project'
