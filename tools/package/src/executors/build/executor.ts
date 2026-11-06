import type { BuildExecutorOptions } from '@hyperfrontend/workspace/executors/build'
import type { Executor } from '@hyperfrontend/workspace/runner'
import { join } from 'node:path'
import { logger } from '@hyperfrontend/logging'
import { buildExecutor } from '@hyperfrontend/workspace/executors/build'
import { prepareDistReadme } from '../../readme/prepare-dist-readme'
import { DOCS_BASE_URL, MEDIA_PUBLIC_BASE_URL, MEDIA_ROOT, WORKSPACE_SCOPE } from './wrapper-config'

/**
 * This repository's build: the workspace package's `build` executor, then the README the
 * registry shows. The readme npm packs is the source readme with its title replaced by the
 * package banner and its marked regions replaced by committed visuals; it is written into the
 * output after the build, so the source stays the one humans maintain and the output holds the
 * one readers of the registry see.
 *
 * @param options - The options of the workspace package's `build` executor
 * @param context - The workspace, the project and the target the task runs on
 * @returns Whether the build and the README preparation succeeded
 */
const runExecutor: Executor<BuildExecutorOptions> = async (options, context) => {
  const built = await buildExecutor(options, context)
  const projectConfig = context.projects[context.projectName]
  // why: a project with no publish target never reaches the registry, so its output keeps the source readme and needs no recorded banner
  if (!built.success || projectConfig?.targets?.['publish'] === undefined) return built
  try {
    const prepared = prepareDistReadme({
      workspaceRoot: context.root,
      projectRoot: join(context.root, projectConfig.root),
      outputPath: options.outputPath ? join(context.root, options.outputPath) : join(context.root, 'dist', projectConfig.root),
      mediaRoot: MEDIA_ROOT,
      publicBaseUrl: MEDIA_PUBLIC_BASE_URL,
      docsBaseUrl: DOCS_BASE_URL,
      packageScope: WORKSPACE_SCOPE,
    })
    if (prepared !== undefined && prepared.outcome.replacements.length > 0) {
      logger.log(`README prepared for the registry: ${prepared.outcome.replacements.map((replacement) => replacement.id).join(', ')}`)
    }
    return { success: true }
  } catch (error) {
    logger.error(`Failed to build ${context.projectName}`)
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    return { success: false }
  }
}

export default runExecutor
