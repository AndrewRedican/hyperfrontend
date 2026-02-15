import type { ExecutorContext } from '@nx/devkit'
import { logger } from '@nx/devkit'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { InstallExecutorOptions } from './schema'

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
export default async function installExecutor(options: InstallExecutorOptions, context: ExecutorContext): Promise<{ success: boolean }> {
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

  const command = options.ci ? 'npm ci' : 'npm install'
  const flags = options.frozen ? '--frozen-lockfile' : ''
  const fullCommand = `${command} ${flags}`.trim()

  logger.info(`Installing dependencies for ${projectName}...`)
  logger.info(`  Running: ${fullCommand}`)
  logger.info(`  In: ${cwd}`)

  try {
    execSync(fullCommand, { cwd, stdio: 'inherit' })
    logger.info(`Dependencies installed for ${projectName}`)
    return { success: true }
  } catch {
    logger.error(`Failed to install dependencies for ${projectName}`)
    return { success: false }
  }
}
