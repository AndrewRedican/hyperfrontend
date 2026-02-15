import type { ExecutorContext } from '@nx/devkit'
import { logger } from '@nx/devkit'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ServeExecutorOptions } from './schema'

/**
 * Serve executor for hyperfrontend application projects.
 *
 * Runs the development server for an application project. Supports
 * self-contained dependency management where each application maintains
 * its own node_modules.
 *
 * @param options - Executor options including command and port
 * @param context - Executor context providing project information
 * @returns An object indicating success or failure of the serve command
 */
export default async function serveExecutor(options: ServeExecutorOptions, context: ExecutorContext): Promise<{ success: boolean }> {
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

  let command = options.command ?? 'npm run dev'
  if (options.port) {
    command = `${command} -- --port ${options.port}`
  }

  logger.info(`Serving ${projectName}...`)
  logger.info(`  Running: ${command}`)
  logger.info(`  In: ${cwd}`)

  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      stdio: 'inherit',
      shell: true,
    })

    child.on('error', (error) => {
      logger.error(`Failed to start server: ${error.message}`)
      resolve({ success: false })
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ success: true })
      } else {
        logger.error(`Server exited with code ${code}`)
        resolve({ success: false })
      }
    })

    process.on('SIGINT', () => {
      child.kill('SIGINT')
    })

    process.on('SIGTERM', () => {
      child.kill('SIGTERM')
    })
  })
}
