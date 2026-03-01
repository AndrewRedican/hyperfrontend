import type { ExecutorContext } from '@nx/devkit'
import type { PublishExecutorOptions } from './schema'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '@nx/devkit'

/**
 * Verifies the project is a publishable library.
 *
 * @param projectConfig - Project configuration from Nx
 * @param projectConfig.projectType - Type of the project (e.g., 'library', 'application')
 * @returns True if the project is a library
 */
function isLibraryProject(projectConfig: { projectType?: string }): boolean {
  return projectConfig.projectType === 'library'
}

/**
 * Gets the dist output path for a project.
 *
 * @param projectRelativePath - Project path relative to workspace root
 * @param workspaceRoot - Absolute path to workspace root
 * @returns Absolute path to the dist output directory
 */
function getDistPath(projectRelativePath: string, workspaceRoot: string): string {
  return join(workspaceRoot, 'dist', projectRelativePath)
}

/**
 * Reads package name from dist package.json.
 *
 * @param distPath - Absolute path to dist directory
 * @returns Name of the package as defined in dist/package.json
 */
function getPackageName(distPath: string): string {
  const pkgPath = join(distPath, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  return pkg.name
}

/**
 * Reads package version from dist package.json.
 *
 * @param distPath - Absolute path to dist directory
 * @returns Version of the package as defined in dist/package.json
 */
function getPackageVersion(distPath: string): string {
  const pkgPath = join(distPath, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  return pkg.version
}

/**
 * Builds the npm publish command with options.
 *
 * @param options - Options for the publish executor
 * @returns npm publish command string
 */
function buildPublishCommand(options: PublishExecutorOptions): string {
  const args: string[] = ['npm', 'publish']

  if (options.dryRun) {
    args.push('--dry-run')
  }

  if (options.registry) {
    args.push('--registry', options.registry)
  }

  if (options.tag) {
    args.push('--tag', options.tag)
  }

  if (options.access) {
    args.push('--access', options.access)
  }

  if (options.otp) {
    args.push('--otp', options.otp)
  }

  return args.join(' ')
}

/**
 * Publish executor for hyperfrontend library packages.
 *
 * Publishes built packages to npm registry with support for:
 * - Dry-run mode to preview what would be published
 * - Custom registry URL
 * - NPM dist-tags
 * - Scope access control
 * - 2FA OTP support
 *
 * @param options - Options for the publish executor
 * @param context - Nx executor context
 * @returns Success status
 */
export default async function publishExecutor(options: PublishExecutorOptions, context: ExecutorContext): Promise<{ success: boolean }> {
  const { projectName, root: workspaceRoot } = context

  if (!projectName) {
    logger.error('Project name is required')
    return { success: false }
  }

  const projectConfig = context.projectsConfigurations?.projects[projectName]
  if (!projectConfig) {
    logger.error(`Could not find project configuration for ${projectName}`)
    return { success: false }
  }

  if (!isLibraryProject(projectConfig)) {
    logger.error(`Project ${projectName} is not a library. Only libraries can be published.`)
    logger.error(`Project type: ${projectConfig.projectType}`)
    return { success: false }
  }

  const projectRelativePath = projectConfig.root
  const distPath = getDistPath(projectRelativePath, workspaceRoot)

  if (!existsSync(distPath)) {
    logger.error(`Dist directory not found: ${distPath}`)
    logger.error(`Run 'nx build ${projectName}' first to build the package.`)
    return { success: false }
  }

  const distPkgPath = join(distPath, 'package.json')
  if (!existsSync(distPkgPath)) {
    logger.error(`package.json not found in dist: ${distPkgPath}`)
    return { success: false }
  }

  const packageName = getPackageName(distPath)
  const packageVersion = getPackageVersion(distPath)

  // Check if version already exists on npm (idempotent publish)
  if (!options.dryRun) {
    try {
      const npmViewResult = execSync(`npm view ${packageName}@${packageVersion} version 2>/dev/null || echo ""`, {
        encoding: 'utf-8',
        cwd: distPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()

      if (npmViewResult === packageVersion) {
        logger.info(`${packageName}@${packageVersion} already published to npm, skipping`)
        return { success: true }
      }
    } catch {
      // npm view failed, assume package doesn't exist (first publish)
    }
  }

  logger.info(`Publishing ${packageName}@${packageVersion}...`)
  logger.info(`  Dist path: ${distPath}`)
  logger.info(`  Tag: ${options.tag ?? 'latest'}`)
  logger.info(`  Access: ${options.access ?? 'public'}`)
  if (options.registry) {
    logger.info(`  Registry: ${options.registry}`)
  }
  if (options.dryRun) {
    logger.info(`  Mode: DRY RUN (no actual publish)`)
  }

  const command = buildPublishCommand(options)
  logger.info(`  Command: ${command}`)

  try {
    const output = execSync(command, {
      cwd: distPath,
      encoding: 'utf-8',
      stdio: 'pipe',
    })

    if (output) {
      logger.info(output)
    }

    if (options.dryRun) {
      logger.info(`\nDry run complete for ${packageName}@${packageVersion}`)
      logger.info('No package was actually published.')
    } else {
      logger.info(`\nSuccessfully published ${packageName}@${packageVersion}`)
    }

    return { success: true }
  } catch (error) {
    logger.error(`Failed to publish ${packageName}`)
    if (error instanceof Error) {
      logger.error(error.message)
      if ('stderr' in error) {
        logger.error(String((error as { stderr: unknown }).stderr))
      }
    }
    return { success: false }
  }
}
