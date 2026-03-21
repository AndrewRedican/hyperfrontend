import type { ExecutorContext } from '@nx/devkit'
import type { TypecheckExecutorOptions } from './schema'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '@nx/devkit'

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

  const tsConfigPath = options.tsConfig ? join(workspaceRoot, options.tsConfig) : join(workspaceRoot, projectRoot, 'tsconfig.lib.json')

  if (!existsSync(tsConfigPath)) {
    logger.error(`TypeScript config not found: ${tsConfigPath}`)
    return { success: false }
  }

  // Use workspace's local tsc to prevent auto-download security risk
  const tscPath = join(workspaceRoot, 'node_modules', '.bin', 'tsc')
  if (!existsSync(tscPath)) {
    logger.error(`TypeScript compiler not found at: ${tscPath}`)
    logger.error('Please run npm install to ensure TypeScript is installed.')
    return { success: false }
  }

  logger.info(`Type checking ${projectName}...`)
  logger.info(`  Using config: ${tsConfigPath}`)

  try {
    execFileSync(tscPath, ['--noEmit', '-p', tsConfigPath], {
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
