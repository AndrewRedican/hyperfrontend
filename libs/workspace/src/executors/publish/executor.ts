/**
 * The `publish` executor: publishes a library's build output to the npm registry, and skips a
 * version the registry already has.
 *
 * @module executors/publish/executor
 */

import type { ExecutorContext, ExecutorResult } from '../../runner/contract'
import type { PublishExecutorOptions } from './options'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { shimCommand } from '@hyperfrontend/project-scope/core/process'
import { logger } from '../shared/logger'
import { buildOutputOf } from '../shared/workspace'

/**
 * Slice of a project configuration relevant to {@link isLibraryProject}.
 */
type LibraryProjectConfig = {
  /** Type of the project (e.g., 'library', 'application') */
  projectType?: string
}

/**
 * Errors thrown by `child_process` may carry a `stderr` field beyond the
 * standard `Error` shape; this captures it without committing to the full
 * Node.js error type.
 */
type ErrorWithStderr = {
  /** Standard error output */
  stderr: unknown
}

/**
 * Verifies the project is a publishable library.
 *
 * @param projectConfig - The project configuration
 * @param projectConfig.projectType - Type of the project (e.g., 'library', 'application')
 * @returns True if the project is a library
 */
function isLibraryProject(projectConfig: LibraryProjectConfig): boolean {
  return projectConfig.projectType === 'library'
}

/**
 * Reads package name from dist package.json.
 *
 * @param distPath - Absolute path to dist directory
 * @returns Name of the package as defined in dist/package.json
 */
function getPackageName(distPath: string): string {
  const pkgPath = join(distPath, 'package.json')
  const pkg = parse(readFileSync(pkgPath, 'utf-8'))
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
  const pkg = parse(readFileSync(pkgPath, 'utf-8'))
  return pkg.version
}

/**
 * Builds the npm publish arguments array. A dry run keeps `--provenance`: npm signs the
 * provenance statement only when it uploads, so the dry run previews the real command and
 * needs no identity token.
 *
 * @param options - Options for the publish executor
 * @returns Array of npm publish command arguments
 *
 * @example A dry run keeps the provenance flag
 * ```typescript
 * buildPublishArgs({ dryRun: true, tag: 'next', provenance: true })
 * // => ['publish', '--dry-run', '--tag', 'next', '--provenance']
 * ```
 */
export function buildPublishArgs(options: PublishExecutorOptions): string[] {
  const args: string[] = ['publish']

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

  if (options.provenance) {
    args.push('--provenance')
  }

  return args
}

/**
 * Publish executor for the libraries of a workspace.
 *
 * Publishes a library's build output, wherever its `build` target writes it, to the npm registry with support for:
 * - Dry-run mode to preview what would be published
 * - Custom registry URL
 * - NPM dist-tags
 * - Scope access control
 * - 2FA OTP support
 *
 * @param options - Options for the publish executor
 * @param context - The workspace, the project and the target the task runs on
 * @returns Success status
 *
 * @example A `publish` target run after the build
 * ```json
 * {
 *   "targets": {
 *     "publish": {
 *       "executor": "@hyperfrontend/workspace:publish",
 *       "dependsOn": ["build"],
 *       "options": { "access": "public", "tag": "latest", "provenance": true }
 *     }
 *   }
 * }
 * ```
 * `npx hf run lib-core:publish --dryRun` previews the npm command; a version the registry already has is skipped with success.
 */
export async function publishExecutor(options: PublishExecutorOptions, context: ExecutorContext): Promise<ExecutorResult> {
  const { projectName, root: workspaceRoot } = context

  if (!projectName) {
    logger.error('Project name is required')
    return { success: false }
  }

  const projectConfig = context.projects[projectName]
  if (!projectConfig) {
    logger.error(`Could not find project configuration for ${projectName}`)
    return { success: false }
  }

  if (!isLibraryProject(projectConfig)) {
    logger.error(`Project ${projectName} is not a library. Only libraries can be published.`)
    logger.error(`Project type: ${projectConfig.projectType}`)
    return { success: false }
  }

  const distPath = buildOutputOf(workspaceRoot, projectConfig)

  if (!existsSync(distPath)) {
    logger.error(`Dist directory not found: ${distPath}`)
    logger.error(`Run the task ${projectName}:build first to build the package.`)
    return { success: false }
  }

  const distPkgPath = join(distPath, 'package.json')
  if (!existsSync(distPkgPath)) {
    logger.error(`package.json not found in dist: ${distPkgPath}`)
    return { success: false }
  }

  const packageName = getPackageName(distPath)
  const packageVersion = getPackageVersion(distPath)

  if (!options.dryRun) {
    try {
      const view = shimCommand('npm', ['view', `${packageName}@${packageVersion}`, 'version'])
      const npmViewResult = execFileSync(view.file, view.args, {
        encoding: 'utf-8',
        cwd: distPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: view.shell,
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

  const args = buildPublishArgs(options)
  logger.info(`  Command: npm ${args.join(' ')}`)

  try {
    const publish = shimCommand('npm', args)
    const output = execFileSync(publish.file, publish.args, { cwd: distPath, encoding: 'utf-8', stdio: 'pipe', shell: publish.shell })

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
        logger.error(String((error as ErrorWithStderr).stderr))
      }
    }
    return { success: false }
  }
}
