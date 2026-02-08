import { type ExecutorContext, logger } from '@nx/devkit'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TypecheckExecutorOptions } from './schema'

/**
 * Typecheck executor for hyperfrontend library packages.
 *
 * Runs TypeScript compiler in --noEmit mode to validate types without
 * producing output files. This is faster than a full build and useful
 * for CI pipelines to catch type errors early.
 *
 * @param options - Executor options including tsConfig path
 * @param context - Executor context providing project information
 * @returns An object indicating success or failure of the type check
 */
export default async function typecheckExecutor(
  options: TypecheckExecutorOptions,
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
  const workspaceRoot = context.root

  // Resolve tsconfig path
  const tsConfigPath = options.tsConfig ? join(workspaceRoot, options.tsConfig) : join(workspaceRoot, projectRoot, 'tsconfig.lib.json')

  if (!existsSync(tsConfigPath)) {
    logger.error(`TypeScript config not found: ${tsConfigPath}`)
    return { success: false }
  }

  logger.info(`Type checking ${projectName}...`)
  logger.info(`  Using config: ${tsConfigPath}`)

  try {
    execSync(`npx tsc --noEmit -p "${tsConfigPath}"`, {
      cwd: workspaceRoot,
      stdio: 'inherit',
      encoding: 'utf-8',
    })

    logger.info(`Type check passed for ${projectName}`)
    return { success: true }
  } catch {
    logger.error(`Type check failed for ${projectName}`)
    return { success: false }
  }
}
