import type { VersionBuilderSchema } from '@jscutlery/semver/src/executors/version/schema'
import type { ExecutorContext } from '@nx/devkit'
import type { VersionExecutorOptions } from './schema'
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
import semverVersion from '@jscutlery/semver/src/executors/version'
import { logger } from '@nx/devkit'

/**
 * Checks if the last commit is a version/release commit for a specific project.
 * Prevents infinite recursion when versioning triggers another version.
 *
 * This check is PROJECT-SPECIFIC: if package A was just versioned, this will
 * only return true when checking package A. Package B can still be versioned
 * even if the last commit was a version commit for package A.
 *
 * Recognized commit formats:
 * - Manual: `chore(lib-x): release version 1.0.0`
 * - PR CI: `chore: update versions for lib-x`
 * - Alternative: `chore(release): lib-x 1.0.0`
 *
 * @param cwd - Working directory
 * @param projectName - The Nx project name to check for
 * @returns True if current HEAD is a version commit for this specific project
 */
function isVersionCommit(cwd: string, projectName: string): boolean {
  try {
    const msg = execSync('git log -1 --pretty=%B', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    // Security: Reject excessively long commit messages
    // Normal commit messages are well under 1KB; 10KB is a generous limit
    if (msg.length > 10000) {
      return false
    }

    // Get first line only (commit subject)
    const firstLine = msg.split('\n')[0].trim()

    // Pattern 1: Manual versioning - chore(lib-x): release version X.Y.Z
    const manualPrefix = `chore(${projectName}): release version`
    if (firstLine.startsWith(manualPrefix)) {
      return true
    }

    // Pattern 2: PR CI versioning - chore: update versions for lib-x
    // Also handles multiple packages: chore: update versions for lib-a lib-b
    // May include [skip ci] suffix: chore: update versions for lib-a lib-b [skip ci]
    const ciPrefix = 'chore: update versions for '
    if (firstLine.startsWith(ciPrefix)) {
      let packagePart = firstLine.slice(ciPrefix.length)

      // Strip [skip ci] suffix if present
      const skipCiSuffix = ' [skip ci]'
      if (packagePart.endsWith(skipCiSuffix)) {
        packagePart = packagePart.slice(0, -skipCiSuffix.length)
      }

      // Split by whitespace/comma without regex - replace commas with spaces then split
      const packages = packagePart
        .split(',')
        .join(' ')
        .split(' ')
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && p.length < 100 && isValidPackageName(p))

      if (packages.includes(projectName)) {
        return true
      }
    }

    // Pattern 3: Alternative release format - chore(release): lib-x X.Y.Z
    const altPrefix = 'chore(release): '
    if (firstLine.startsWith(altPrefix)) {
      const rest = firstLine.slice(altPrefix.length).trimStart()
      // Check if projectName is at the start followed by space or end of string
      if (rest === projectName || rest.startsWith(projectName + ' ')) {
        return true
      }
    }

    return false
  } catch {
    return false
  }
}

/**
 * Validates that a string looks like a valid npm package name.
 * Only allows: alphanumeric, @, /, -, _
 *
 * @param name - Package name to validate
 * @returns True if valid
 */
function isValidPackageName(name: string): boolean {
  for (const char of name) {
    const code = char.charCodeAt(0)
    // a-z, A-Z, 0-9, @, /, -, _
    const isValid =
      (code >= 97 && code <= 122) || // a-z
      (code >= 65 && code <= 90) || // A-Z
      (code >= 48 && code <= 57) || // 0-9
      code === 64 || // @
      code === 47 || // /
      code === 45 || // -
      code === 95 // _
    if (!isValid) {
      return false
    }
  }
  return true
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
 * tagged release. This function removes the existing entry AND the header
 * so semver can regenerate the file fresh (semver always generates a header).
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

    // Get content after the target version section (previous releases)
    const remainingLines = lines.slice(targetEndIndex)
    // semver will regenerate the header, so we only keep previous version entries
    const newContent = remainingLines.length > 0 ? remainingLines.join('\n') : ''

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
 * Updates e2e app dependencies when a library version is bumped.
 *
 * E2e apps use file references to tarballs with version in the filename:
 * "@hyperfrontend/cryptography": "file:../../../tmp/e2e-packs/hyperfrontend-cryptography-0.0.2.tgz"
 *
 * When the library version changes, this updates the tarball version in the path.
 *
 * @param packageName - The npm package name that was updated (e.g., '@hyperfrontend/cryptography')
 * @param newVersion - The new version to set
 * @param workspaceRoot - The workspace root directory
 * @param dryRun - If true, don't actually write changes
 * @returns Array of updated package.json paths (relative to workspace root)
 */
function updateE2eDependencies(packageName: string, newVersion: string, workspaceRoot: string, dryRun: boolean): string[] {
  const updatedFiles: string[] = []
  const e2eDir = join(workspaceRoot, 'apps', 'package-e2e')

  if (!existsSync(e2eDir)) {
    return updatedFiles
  }

  const packageJsonFiles = findPackageJsonFiles(e2eDir)

  // Extract library slug from package name: @hyperfrontend/cryptography -> cryptography
  // Handle scoped packages and convert to tarball naming convention
  const packageSlug = packageName.replace(/^@hyperfrontend\//, '').replace(/-utils$/, '-utils')
  // Tarball pattern: hyperfrontend-{slug}-{version}.tgz
  const tgzPattern = new RegExp(`hyperfrontend-${packageSlug}-\\d+\\.\\d+\\.\\d+\\.tgz`)
  const newTgzName = `hyperfrontend-${packageSlug}-${newVersion}.tgz`

  for (const packageJsonPath of packageJsonFiles) {
    try {
      const content = readFileSync(packageJsonPath, 'utf-8')
      const pkg = JSON.parse(content)
      let modified = false

      // Check dependencies for matching package
      if (pkg.dependencies && pkg.dependencies[packageName] !== undefined) {
        const currentValue = pkg.dependencies[packageName]
        // Only update file: references that match the tarball pattern
        if (typeof currentValue === 'string' && currentValue.startsWith('file:') && tgzPattern.test(currentValue)) {
          const newValue = currentValue.replace(tgzPattern, newTgzName)
          if (newValue !== currentValue) {
            pkg.dependencies[packageName] = newValue
            modified = true
          }
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

  // Normalize collectFiles mode: implies skipCommit and skipTag
  if (options.collectFiles) {
    options.skipCommit = true
    options.skipTag = true
  }

  // Track all modified files for --collectFiles output
  const modifiedFiles: string[] = []

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
  // Note: This is PROJECT-SPECIFIC - only skips if THIS project was just versioned
  if (options.skipIfVersionCommit !== false && isVersionCommit(workspaceRoot, projectName)) {
    logger.info(`${projectName}: Skipping - current commit is a version/release commit for this project`)
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

  // For unreleased versions (no tag for current version), clear existing changelog
  // entry so semver regenerates it with ALL commits since last tagged release.
  // This handles the case where version command was run but not pushed.
  if (!tagExists(expectedTag, workspaceRoot)) {
    const cleared = clearUnreleasedChangelogEntry(changelogPath, currentVersion, options.dryRun ?? false)
    if (cleared) {
      logger.info(`${projectName}: Cleared existing changelog entry for unreleased ${currentVersion}`)
    }
  }

  logger.info(`${projectName}: Delegating to @jscutlery/semver:version`)

  // Default preset configuration that includes docs commits for version bumps.
  // docs commits trigger MINOR bumps (considered meaningful changes in this project).
  // This aligns with the philosophy that documentation updates are valuable user-facing changes.
  const defaultPreset = {
    name: 'conventionalcommits',
    types: [
      { type: 'feat', section: 'Features' },
      { type: 'fix', section: 'Bug Fixes' },
      { type: 'perf', section: 'Performance Improvements' },
      { type: 'docs', section: 'Documentation' }, // Triggers MINOR bump
      { type: 'build', section: 'Build System' },
      { type: 'refactor', section: 'Code Refactoring', hidden: true },
      { type: 'style', hidden: true },
      { type: 'test', hidden: true },
      { type: 'ci', hidden: true },
      { type: 'chore', hidden: true },
    ],
  }

  // Delegate to @jscutlery/semver:version
  // Use custom preset if provided, otherwise use our default that includes docs
  const semverOptions: VersionBuilderSchema = <VersionBuilderSchema>{
    ...options,
    preset: options.preset ?? defaultPreset,
    skipCommitTypes: options.skipCommitTypes ?? [],
  }

  const result = await semverVersion(semverOptions, context)

  if (result.success) {
    logger.info(`${projectName}: version updated`)

    // Track project's own modified files (relative to workspace root)
    modifiedFiles.push(join(projectRoot, 'package.json'))
    if (existsSync(changelogPath)) {
      modifiedFiles.push(join(projectRoot, 'CHANGELOG.md'))
    }

    // Update dependent packages' version references (enabled by default)
    const shouldUpdateDependents = options.updateDependents !== false
    if (shouldUpdateDependents) {
      const packageName = getPackageName(packageJsonPath)
      const newVersion = getPackageVersion(packageJsonPath)

      if (packageName && newVersion !== '0.0.0') {
        const updatedFiles = updateDependentVersions(packageName, newVersion, workspaceRoot, packageJsonPath, options.dryRun ?? false)

        // Collect all files to stage/amend (library dependents + e2e deps)
        const allUpdatedFiles: string[] = [...updatedFiles]

        // Update e2e app dependencies
        const e2eUpdatedFiles = updateE2eDependencies(packageName, newVersion, workspaceRoot, options.dryRun ?? false)
        allUpdatedFiles.push(...e2eUpdatedFiles)

        if (updatedFiles.length > 0) {
          logger.info(`${projectName}: Updated dependency version in ${updatedFiles.length} library package(s):`)
          for (const file of updatedFiles) {
            logger.info(`  - ${file}`)
          }
        }

        if (e2eUpdatedFiles.length > 0) {
          logger.info(`${projectName}: Updated e2e app dependency in ${e2eUpdatedFiles.length} package(s):`)
          for (const file of e2eUpdatedFiles) {
            logger.info(`  - ${file}`)
          }
        }

        if (allUpdatedFiles.length > 0) {
          // Track all files for --collectFiles output
          modifiedFiles.push(...allUpdatedFiles)

          // Stage the updated files for the commit (if not dry run and not skipping commit)
          if (!options.dryRun && !options.skipCommit) {
            try {
              for (const file of allUpdatedFiles) {
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

    // Output modified files to stdout for --collectFiles mode
    if (options.collectFiles) {
      for (const file of modifiedFiles) {
        process.stdout.write(`MODIFIED:${file}\n`)
      }
    }
  }

  return result
}
