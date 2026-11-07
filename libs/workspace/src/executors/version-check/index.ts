/**
 * The `version-check` executor: compares a project's manifest and changelog with what its commits call for, without writing anything.
 *
 * @module executors/version-check
 */

export type { VersionCheckExecutorOptions } from './options'
export { versionCheckExecutor, versionCheckExecutor as default } from './executor'
