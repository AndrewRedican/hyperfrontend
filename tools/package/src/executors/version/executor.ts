import type { VersionExecutorOptions } from '@hyperfrontend/workspace/executors/version'
import type { Executor } from '@hyperfrontend/workspace/runner'
import { versionExecutor } from '@hyperfrontend/workspace/executors/version'
import { compatibilityFollowUp } from './lib/refresh-compatibility-matrix'

/**
 * This repository's version run: the workspace package's `version` executor, with the root
 * compatibility document brought in line with the bump and committed with it.
 *
 * @param options - The options of the workspace package's `version` executor
 * @param context - The workspace, the project and the target the task runs on
 * @returns Whether the version run succeeded
 */
const runExecutor: Executor<VersionExecutorOptions> = (options, context) =>
  versionExecutor({ ...options, followUps: [compatibilityFollowUp] }, context)

export default runExecutor
