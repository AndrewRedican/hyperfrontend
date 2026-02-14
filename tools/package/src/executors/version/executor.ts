import { type ExecutorContext, logger } from '@nx/devkit'
import { execSync } from 'node:child_process'
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
  openSync,
  fstatSync,
  closeSync,
  ftruncateSync,
  writeSync,
  readSync,
} from 'node:fs'
import { join, relative } from 'node:path'
import type { VersionExecutorOptions } from './schema'
import semverVersion from '@jscutlery/semver/src/executors/version'
import type { VersionBuilderSchema } from '@jscutlery/semver/src/executors/version/schema'

/**
 * Patterns that identify version/release commits.
 * Used for recursion prevention - if HEAD matches, skip versioning.
 */
const VERSION_COMMIT_PATTERNS = [
  /^chore\([^)]+\): release version/, // Manual: chore(lib-x): release version 1.0.0
  /^chore: update versions for/, // PR CI: chore: update versions for lib-x
  /^chore\(release\):/, // Alternative format
]

/**
 * Checks if the last commit is a version/release commit.
 * Prevents infinite recursion when versioning triggers another version.
 *
 * @param cwd - Working directory
 * @returns True if current HEAD is a version commit
 */
function isVersionCommit(cwd: string): boolean {
  try {
    const msg = execSync('git log -1 --pretty=%B', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return VERSION_COMMIT_PATTERNS.some((pattern) => pattern.test(msg))
  } catch {
    return false
  }
}

/**
 * Checks if git is in a rebase or merge state.
 * Versioning during these operations can cause problems.
 *
 * @param cwd - Working directory
 * @returns True if git is in rebase/merge state
 */
function isInUnstableGitState(cwd: string): boolean {
  try {
    const gitDir = execSync('git rev-parse --git-dir', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    return (
      existsSync(join(cwd, gitDir, 'rebase-merge')) ||
      existsSync(join(cwd, gitDir, 'rebase-apply')) ||
      existsSync(join(cwd, gitDir, 'MERGE_HEAD'))
    )
  } catch {
    return false
  }
}

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
 * Checks if a line is a version header and extracts the version.
 * Handles formats: "## 1.0.0", "## [1.0.0]", "## 1.0.0 (2026-02-14)"
 *
 * @param line - Line to check
 * @returns Version string if this is a version header, null otherwise
 */
function extractVersionFromHeader(line: string): string | null {
  if (!line.startsWith('## ')) {
    return null
  }

  // Get content after "## "
  let content = line.slice(3).trim()

  // Remove brackets if present: "[1.0.0]" -> "1.0.0"
  if (content.startsWith('[')) {
    const closeBracket = content.indexOf(']')
    if (closeBracket > 0) {
      content = content.slice(1, closeBracket)
    }
  }

  // Extract version (everything before space or parenthesis)
  const spaceIndex = content.indexOf(' ')
  const parenIndex = content.indexOf('(')
  let endIndex = content.length

  if (spaceIndex > 0 && spaceIndex < endIndex) endIndex = spaceIndex
  if (parenIndex > 0 && parenIndex < endIndex) endIndex = parenIndex

  const version = content.slice(0, endIndex).trim()

  // Basic validation: should start with a digit (semver-like)
  if (version.length > 0 && version[0] >= '0' && version[0] <= '9') {
    return version
  }

  return null
}

/**
 * Clears an unreleased version's entry from CHANGELOG.md.
 *
 * For unreleased versions (no git tag), the changelog entry should be
 * regenerated on each version run to include all commits since the last
 * tagged release. This function removes the existing entry so semver
 * can regenerate it fresh.
 *
 * Uses file descriptors to prevent TOCTOU race conditions.
 *
 * @param changelogPath - Path to CHANGELOG.md
 * @param version - Version to clear (e.g., '1.0.0')
 * @param dryRun - If true, don't actually write changes
 * @returns True if entry was cleared
 */
function clearUnreleasedChangelogEntry(changelogPath: string, version: string, dryRun: boolean): boolean {
  let fd: number | null = null

  try {
    // Open file with read/write access - fails if file doesn't exist
    // Using 'r+' prevents creating new files and requires existing file
    fd = openSync(changelogPath, 'r+')

    // Get stats using fd (not path) to prevent TOCTOU race
    const stats = fstatSync(fd)

    // Ensure it's a regular file (not symlink, directory, etc.)
    if (!stats.isFile()) {
      return false
    }

    // Read file content using the fd
    const buffer = Buffer.alloc(stats.size)
    readSync(fd, buffer, 0, stats.size, 0)
    const content = buffer.toString('utf-8')

    const lines = content.split('\n')

    let targetStartIndex = -1
    let targetEndIndex = lines.length

    // Find the version section boundaries
    for (let i = 0; i < lines.length; i++) {
      const lineVersion = extractVersionFromHeader(lines[i])

      if (lineVersion === version && targetStartIndex === -1) {
        // Found the start of target version section
        targetStartIndex = i
      } else if (lineVersion !== null && targetStartIndex !== -1) {
        // Found the next version section - this is where target section ends
        targetEndIndex = i
        break
      }
    }

    if (targetStartIndex === -1) {
      return false // Version entry doesn't exist
    }

    // Remove the version section
    const newLines = [...lines.slice(0, targetStartIndex), ...lines.slice(targetEndIndex)]
    const newContent = newLines.join('\n')

    if (!dryRun) {
      // Truncate file and write new content using the same fd
      const newBuffer = Buffer.from(newContent, 'utf-8')
      ftruncateSync(fd, 0)
      writeSync(fd, newBuffer, 0, newBuffer.length, 0)
    }

    return true
  } catch {
    return false
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd)
      } catch {
        // Ignore close errors
      }
    }
  }
}

/**
 * Gets the package name from package.json.
 *
 * @param packageJsonPath - Path to package.json
 * @returns Package name or null if not found
 */
function getPackageName(packageJsonPath: string): string | null {
  try {
    const content = readFileSync(packageJsonPath, 'utf-8')
    const pkg = JSON.parse(content)
    return pkg.name || null
  } catch {
    return null
  }
}

/**
 * Recursively finds all package.json files in a directory.
 *
 * @param dir - Directory to search
 * @param results - Accumulator for found paths
 * @returns Array of package.json paths
 */
function findPackageJsonFiles(dir: string, results: string[] = []): string[] {
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      // Skip node_modules, dist, and hidden directories
      if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) {
        continue
      }
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        findPackageJsonFiles(fullPath, results)
      } else if (entry === 'package.json') {
        results.push(fullPath)
      }
    }
  } catch {
    // Ignore errors (permission denied, etc.)
  }
  return results
}

/**
 * Updates dependency version references in all workspace packages.
 *
 * @param packageName - The npm package name that was updated (e.g., '@hyperfrontend/data-utils')
 * @param newVersion - The new version to set
 * @param workspaceRoot - The workspace root directory
 * @param currentPackageJsonPath - Path to the current package's package.json (to skip)
 * @param dryRun - If true, don't actually write changes
 * @returns Array of updated package.json paths
 */
function updateDependentVersions(
  packageName: string,
  newVersion: string,
  workspaceRoot: string,
  currentPackageJsonPath: string,
  dryRun: boolean
): string[] {
  const updatedFiles: string[] = []
  const libsDir = join(workspaceRoot, 'libs')
  const packageJsonFiles = findPackageJsonFiles(libsDir)

  for (const packageJsonPath of packageJsonFiles) {
    // Skip the package that was just versioned
    if (packageJsonPath === currentPackageJsonPath) {
      continue
    }

    try {
      const content = readFileSync(packageJsonPath, 'utf-8')
      const pkg = JSON.parse(content)
      let modified = false

      // Check and update dependencies
      if (pkg.dependencies && pkg.dependencies[packageName] !== undefined) {
        if (pkg.dependencies[packageName] !== newVersion) {
          pkg.dependencies[packageName] = newVersion
          modified = true
        }
      }

      // Check and update peerDependencies
      if (pkg.peerDependencies && pkg.peerDependencies[packageName] !== undefined) {
        if (pkg.peerDependencies[packageName] !== newVersion) {
          pkg.peerDependencies[packageName] = newVersion
          modified = true
        }
      }

      if (modified) {
        const relativePath = relative(workspaceRoot, packageJsonPath)
        if (!dryRun) {
          writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
        }
        updatedFiles.push(relativePath)
      }
    } catch {
      // Ignore errors reading/writing individual files
    }
  }

  return updatedFiles
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

  // === FACT-FINDING: Early exit conditions ===

  // 1. Recursion prevention (enabled by default)
  if (options.skipIfVersionCommit !== false && isVersionCommit(workspaceRoot)) {
    logger.info(`${projectName}: Skipping - current commit is a version/release commit`)
    return { success: true }
  }

  // 2. Git state check (enabled by default)
  if (options.skipIfUnstableGit !== false && isInUnstableGitState(workspaceRoot)) {
    logger.info(`${projectName}: Skipping - git is in rebase/merge state`)
    return { success: true }
  }

  const projectRoot = projectConfig.root
  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json')
  const changelogPath = join(workspaceRoot, projectRoot, 'CHANGELOG.md')
  const tagPrefix = options.tagPrefix || `${projectName}@`
  const currentVersion = getPackageVersion(packageJsonPath)
  const expectedTag = `${tagPrefix}${currentVersion}`

  // Idempotency check: if the tag for current version exists, it's been released - skip
  if (tagExists(expectedTag, workspaceRoot) && !options.releaseAs && !options.allowEmptyRelease) {
    logger.info(`${projectName}: Tag ${expectedTag} already exists (skipping)`)
    return { success: true }
  }

  // For unreleased versions (no tag), clear existing changelog entry so semver
  // regenerates it with ALL commits since last tagged release
  if (!tagExists(expectedTag, workspaceRoot)) {
    const cleared = clearUnreleasedChangelogEntry(changelogPath, currentVersion, options.dryRun ?? false)
    if (cleared) {
      logger.info(`${projectName}: Cleared existing changelog entry for unreleased ${currentVersion}`)
    }
  }

  logger.info(`${projectName}: Delegating to @jscutlery/semver:version`)

  // Delegate to @jscutlery/semver:version
  // Ensure skipCommitTypes defaults to empty array (required by @jscutlery/semver)
  const semverOptions: VersionBuilderSchema = {
    ...options,
    skipCommitTypes: options.skipCommitTypes ?? [],
  } as VersionBuilderSchema

  const result = await semverVersion(semverOptions, context)

  if (result.success) {
    logger.info(`${projectName}: version updated`)

    // Update dependent packages' version references (enabled by default)
    const shouldUpdateDependents = options.updateDependents !== false
    if (shouldUpdateDependents) {
      const packageName = getPackageName(packageJsonPath)
      const newVersion = getPackageVersion(packageJsonPath)

      if (packageName && newVersion !== '0.0.0') {
        const updatedFiles = updateDependentVersions(packageName, newVersion, workspaceRoot, packageJsonPath, options.dryRun ?? false)

        if (updatedFiles.length > 0) {
          logger.info(`${projectName}: Updated dependency version in ${updatedFiles.length} package(s):`)
          for (const file of updatedFiles) {
            logger.info(`  - ${file}`)
          }

          // Stage the updated files for the commit (if not dry run and not skipping commit)
          if (!options.dryRun && !options.skipCommit) {
            try {
              for (const file of updatedFiles) {
                execSync(`git add "${file}"`, {
                  cwd: workspaceRoot,
                  encoding: 'utf-8',
                  stdio: ['pipe', 'pipe', 'pipe'],
                })
              }
              // Amend the version commit to include the dependency updates
              execSync('git commit --amend --no-edit', {
                cwd: workspaceRoot,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
              })
              logger.info(`${projectName}: Amended commit to include dependency updates`)
            } catch (error) {
              logger.warn(`${projectName}: Could not amend commit with dependency updates: ${error}`)
            }
          }
        }
      }
    }
  }

  return result
}
