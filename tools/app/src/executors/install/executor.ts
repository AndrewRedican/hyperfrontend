import type { ExecutorContext } from '@nx/devkit'
import type { InstallExecutorOptions } from './schema'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '../../lib/logger'

/**
 * Install executor for hyperfrontend application projects.
 *
 * Invokes `npm install` or `npm ci` in the target application's project directory,
 * enabling self-contained dependency management where each application maintains
 * its own node_modules.
 *
 * @param options - Executor options including ci and frozen flags
 * @param context - Executor context providing project information
 * @returns An object indicating success or failure of the install
 */
export default async function installExecutor(
  options: InstallExecutorOptions,
  context: ExecutorContext
): Promise<{
  /** Indicates whether the install succeeded. */
  success: boolean
}> {
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

  const args: string[] = options.ci ? ['ci'] : ['install']
  if (options.frozen) {
    args.push('--frozen-lockfile')
  }

  const fullCommand = `npm ${args.join(' ')}`

  logger.info(`Installing dependencies for ${projectName}...`)
  logger.info(`  Running: ${fullCommand}`)
  logger.info(`  In: ${cwd}`)

  try {
    execFileSync('npm', args, { cwd, stdio: 'inherit' })
    logger.info(`Dependencies installed for ${projectName}`)
    return { success: true }
  } catch {
    logger.error(`Failed to install dependencies for ${projectName}`)
    return { success: false }
  }
}
