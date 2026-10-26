import type { ExecutorContext, PromiseExecutor } from '@hyperfrontend/integration-nx/compat'
import type { TypecheckExecutorOptions } from './schema'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { logger } from '../../lib/logger'

/**
 * Typecheck executor for hyperfrontend library packages.
 *
 * Runs the TypeScript compiler in --noEmit mode over the library config and,
 * when the project has one, the spec config. Specs run with their types
 * stripped, so this is the only step that type checks them.
 *
 * @param options - Executor options including the tsconfig paths
 * @param context - Executor context providing project information
 * @returns An object indicating success or failure of the type check
 */
export default async function typecheckExecutor(options: TypecheckExecutorOptions, context: ExecutorContext): ReturnType<PromiseExecutor> {
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

  const tsConfigPaths = [tsConfigPath]
  if (options.specTsConfig) {
    const specTsConfigPath = join(workspaceRoot, options.specTsConfig)
    if (!existsSync(specTsConfigPath)) {
      logger.error(`TypeScript spec config not found: ${specTsConfigPath}`)
      return { success: false }
    }
    tsConfigPaths.push(specTsConfigPath)
  } else {
    const defaultSpecTsConfigPath = join(workspaceRoot, projectRoot, 'tsconfig.spec.json')
    if (existsSync(defaultSpecTsConfigPath)) tsConfigPaths.push(defaultSpecTsConfigPath)
  }

  // why: the launcher in node_modules/.bin is a shell script on POSIX and a .cmd shim on Windows, so the compiler's own entry script runs on the current Node binary instead
  let tscScript: string
  try {
    tscScript = createRequire(join(workspaceRoot, 'package.json')).resolve('typescript/bin/tsc')
  } catch {
    logger.error(`TypeScript compiler not found from: ${workspaceRoot}`)
    logger.error('Please run npm install to ensure TypeScript is installed.')
    return { success: false }
  }

  logger.info(`Type checking ${projectName}...`)

  // why: every config is checked even after one fails, so a single run reports all of the project's errors
  let success = true
  for (const configPath of tsConfigPaths) {
    logger.info(`  Using config: ${configPath}`)
    try {
      execFileSync(process.execPath, [tscScript, '--noEmit', '-p', configPath], {
        cwd: workspaceRoot,
        stdio: 'inherit',
        encoding: 'utf-8',
      })
    } catch {
      logger.error(`  Type check failed for config: ${configPath}`)
      success = false
    }
  }

  if (success) logger.info(`Type check passed for ${projectName}`)
  else logger.error(`Type check failed for ${projectName}`)
  return { success }
}
