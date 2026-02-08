import { type ExecutorContext, logger } from '@nx/devkit'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { VersionExecutorOptions } from './schema'
import semverVersion from '@jscutlery/semver/src/executors/version'
import type { VersionBuilderSchema } from '@jscutlery/semver/src/executors/version/schema'

/**
 * Checks if a git tag exists.
 *
 * @param tag - Tag name to check
 * @param cwd - Working directory
 * @returns True if tag exists
 */
function tagExists(tag: string, cwd: string): boolean {
  try {
    execSync(`git rev-parse ${tag}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Gets the current version from package.json.
 *
 * @param packageJsonPath - Path to package.json
 * @returns Version string or '0.0.0' if not found
 */
function getPackageVersion(packageJsonPath: string): string {
  try {
    const content = readFileSync(packageJsonPath, 'utf-8')
    const pkg = JSON.parse(content)
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/**
 * Idempotent wrapper around \@jscutlery/semver:version.
 *
 * This executor:
 * 1. Checks if the version tag already exists
 * 2. If tagged, skips versioning (idempotent behavior)
 * 3. Otherwise delegates to \@jscutlery/semver:version
 *
 * @param options - Configuration options (passed through to semver)
 * @param context - Nx executor context
 * @returns Success status
 */
export default async function versionExecutor(options: VersionExecutorOptions, context: ExecutorContext): Promise<{ success: boolean }> {
  const { projectName, root: workspaceRoot, projectGraph } = context

  if (!projectName) {
    logger.error('Project name is required')
    return { success: false }
  }

  const projectConfig = projectGraph?.nodes[projectName]?.data
  if (!projectConfig) {
    logger.error(`Project ${projectName} not found in project graph`)
    return { success: false }
  }

  const projectRoot = projectConfig.root
  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json')
  const tagPrefix = options.tagPrefix || `${projectName}@`
  const currentVersion = getPackageVersion(packageJsonPath)
  const expectedTag = `${tagPrefix}${currentVersion}`

  // Idempotency check: if the tag for current version exists, skip
  if (tagExists(expectedTag, workspaceRoot) && !options.releaseAs && !options.allowEmptyRelease) {
    logger.info(`${projectName}: Tag ${expectedTag} already exists (skipping)`)
    return { success: true }
  }

  logger.info(`${projectName}: Delegating to @jscutlery/semver:version`)

  // Delegate to @jscutlery/semver:version
  const result = await semverVersion(options as VersionBuilderSchema, context)

  if (result.success) {
    logger.info(`${projectName}: version updated`)
  }

  return result
}
