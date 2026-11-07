import type { VersionBatchExecutorOptions } from '@hyperfrontend/workspace/executors/version-batch'
import type { Executor } from '@hyperfrontend/workspace/runner'
import { versionBatchExecutor } from '@hyperfrontend/workspace/executors/version-batch'
import { compatibilityFollowUp } from '../version/lib/refresh-compatibility-matrix'

/**
 * This repository's batch: the workspace package's `version-batch` executor, with the root
 * compatibility document brought in line with each bump and committed with them.
 *
 * @param options - The options of the workspace package's `version-batch` executor
 * @param context - The workspace, the project and the target the task runs on
 * @returns Whether the batch succeeded
 */
const runExecutor: Executor<VersionBatchExecutorOptions> = (options, context) =>
  versionBatchExecutor({ ...options, followUps: [compatibilityFollowUp] }, context)

export default runExecutor
