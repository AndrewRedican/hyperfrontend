import type { ExecutorContext } from '@nx/devkit'
import type { BuildExecutorOptions } from './schema'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '@nx/devkit'

/**
 * Build executor for hyperfrontend application projects.
 *
 * Wraps framework-specific build commands, executed within the application's
 * directory. Supports self-contained dependency management where each
 * application maintains its own node_modules.
 *
 * @param options - Executor options including command and outputPath
 * @param context - Executor context providing project information
 * @returns An object indicating success or failure of the build
 */
export default async function buildExecutor(
  options: BuildExecutorOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const projectName = context.projectName
  if (!projectName) {
    logger.error('No project name provided')
    return { success: false }
  }

  const projectConfig = context.projectsConfigurations?.projects[projectName]
  if (!projectConfig) {
    logger.error(`Could not find project configuration for ${projectName}`)
    return { success: false }
  }

  const projectRoot = projectConfig.root
  const cwd = join(context.root, projectRoot)
  const packageJsonPath = join(cwd, 'package.json')

  if (!existsSync(packageJsonPath)) {
    logger.error(`No package.json found in ${cwd}`)
    return { success: false }
  }

  const command = options.command ?? 'npm run build'

  logger.info(`Building ${projectName}...`)
  logger.info(`  Running: ${command}`)
  logger.info(`  In: ${cwd}`)

  try {
    execSync(command, { cwd, stdio: 'inherit' })
    logger.info(`Build completed for ${projectName}`)
    return { success: true }
  } catch {
    logger.error(`Build failed for ${projectName}`)
    return { success: false }
  }
}
