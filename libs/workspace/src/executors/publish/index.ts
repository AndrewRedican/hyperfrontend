/**
 * The `publish` executor: publishes a library's build output to the npm registry, skipping a version already there.
 *
 * @module executors/publish
 */

export type { PublishExecutorOptions } from './options'
export { publishExecutor, publishExecutor as default } from './executor'
