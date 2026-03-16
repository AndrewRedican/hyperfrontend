/**
 * Batch Update
 *
 * Utilities for updating multiple packages at once.
 * Supports updating versions, dependencies, and other package.json fields.
 */

import type { Tree } from '@hyperfrontend/project-scope'
import type { Workspace } from '../models/workspace'
import type { PlannedBump } from './cascade-bump'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
// eslint-disable-next-line @nx/enforce-module-boundaries
import { readFileContent, writeFileContent } from '@hyperfrontend/project-scope'

/**
 * Result of a batch update operation.
 */
export interface BatchUpdateResult {
  /** Packages successfully updated */
  readonly updated: readonly UpdatedPackage[]

  /** Packages that failed to update */
  readonly failed: readonly FailedUpdate[]

  /** Total number of packages processed */
  readonly total: number

  /** Whether all updates succeeded */
  readonly success: boolean
}

/**
 * Information about a successfully updated package.
 */
export interface UpdatedPackage {
  /** Package name */
  readonly name: string

  /** Path to package.json */
  readonly packageJsonPath: string

  /** Previous version */
  readonly previousVersion: string

  /** New version */
  readonly newVersion: string
}

/**
 * Information about a failed update.
 */
export interface FailedUpdate {
  /** Package name */
  readonly name: string

  /** Path to package.json */
  readonly packageJsonPath: string

  /** Error message */
  readonly error: string
}

/**
 * Options for batch update operations.
 */
export interface BatchUpdateOptions {
  /** Whether to perform a dry run (no actual changes) */
  dryRun?: boolean

  /** Whether to update dependency references in other packages */
  updateDependencyReferences?: boolean
}

/**
 * Default batch update options.
 */
export const DEFAULT_BATCH_UPDATE_OPTIONS: Required<BatchUpdateOptions> = {
  dryRun: false,
  updateDependencyReferences: true,
}

/**
 * Applies planned bumps to the workspace.
 * Updates package.json version fields for all affected packages.
 *
 * @param workspace - Workspace containing projects to update
 * @param bumps - Planned version bumps
 * @param options - Update options
 * @returns Batch update result
 *
 * @example
 * ```typescript
 * import { applyBumps, calculateCascadeBumps } from '@hyperfrontend/versioning'
 *
 * const cascadeResult = calculateCascadeBumps(workspace, directBumps)
 * const updateResult = applyBumps(workspace, cascadeResult.bumps)
 *
 * if (updateResult.success) {
 *   console.log(`Updated ${updateResult.updated.length} packages`)
 * } else {
 *   console.error('Some updates failed:', updateResult.failed)
 * }
 * ```
 */
export function applyBumps(workspace: Workspace, bumps: readonly PlannedBump[], options: BatchUpdateOptions = {}): BatchUpdateResult {
  const opts = { ...DEFAULT_BATCH_UPDATE_OPTIONS, ...options }
  const updated: UpdatedPackage[] = []
  const failed: FailedUpdate[] = []

  // Build a map for dependency reference updates
  const versionUpdates = createMap<string, string>()
  for (const bump of bumps) {
    versionUpdates.set(bump.name, bump.nextVersion)
  }

  for (const bump of bumps) {
    const project = workspace.projects.get(bump.name)
    if (!project) {
      failed.push({
        name: bump.name,
        packageJsonPath: '',
        error: 'Project not found in workspace',
      })
      continue
    }

    try {
      if (!opts.dryRun) {
        updatePackageVersion(project.packageJsonPath, bump.nextVersion)
      }

      updated.push({
        name: bump.name,
        packageJsonPath: project.packageJsonPath,
        previousVersion: bump.currentVersion,
        newVersion: bump.nextVersion,
      })
    } catch (error) {
      failed.push({
        name: bump.name,
        packageJsonPath: project.packageJsonPath,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Update dependency references if requested
  if (opts.updateDependencyReferences && !opts.dryRun) {
    for (const project of workspace.projectList) {
      try {
        updateDependencyReferences(project.packageJsonPath, versionUpdates)
      } catch {
        // Dependency reference updates are best-effort
      }
    }
  }

  return {
    updated,
    failed,
    total: bumps.length,
    success: failed.length === 0,
  }
}

/**
 * Updates the version field in a package.json file.
 *
 * @param packageJsonPath - Path to package.json
 * @param newVersion - New version string
 */
function updatePackageVersion(packageJsonPath: string, newVersion: string): void {
  const content = readFileContent(packageJsonPath)
  const pkg = parse(content)
  pkg.version = newVersion
  const formatted = stringify(pkg, null, 2) + '\n'
  writeFileContent(packageJsonPath, formatted)
}

/**
 * Updates dependency version references in a package.json file.
 *
 * @param packageJsonPath - Path to package.json
 * @param versionUpdates - Map of package name to new version
 */
function updateDependencyReferences(packageJsonPath: string, versionUpdates: Map<string, string>): void {
  const content = readFileContent(packageJsonPath)
  const pkg = parse(content)
  let modified = false

  const depTypes = <const>['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

  for (const depType of depTypes) {
    const deps = pkg[depType]
    if (deps) {
      for (const [name, newVersion] of versionUpdates) {
        if (deps[name]) {
          // Preserve version prefix (^, ~, etc.) or use exact version
          const currentRange = deps[name]
          const prefix = extractVersionPrefix(currentRange)
          deps[name] = prefix + newVersion
          modified = true
        }
      }
    }
  }

  if (modified) {
    const formatted = stringify(pkg, null, 2) + '\n'
    writeFileContent(packageJsonPath, formatted)
  }
}

/**
 * Extracts the version prefix from a version range.
 *
 * @param versionRange - Version range string
 * @returns The prefix (^, ~, >=, etc.) or empty string
 */
function extractVersionPrefix(versionRange: string): string {
  if (versionRange.startsWith('^')) return '^'
  if (versionRange.startsWith('~')) return '~'
  if (versionRange.startsWith('>=')) return '>='
  if (versionRange.startsWith('>')) return '>'
  if (versionRange.startsWith('<=')) return '<='
  if (versionRange.startsWith('<')) return '<'
  if (versionRange.startsWith('=')) return '='
  return ''
}

/**
 * Updates a package.json file using a VFS Tree.
 *
 * @param tree - Virtual file system tree
 * @param packageJsonPath - Relative path to package.json
 * @param newVersion - New version string
 */
export function updatePackageVersionInTree(tree: Tree, packageJsonPath: string, newVersion: string): void {
  const content = tree.read(packageJsonPath, 'utf-8')
  if (!content) {
    throw createError(`Could not read ${packageJsonPath}`)
  }

  const pkg = parse(content)
  pkg.version = newVersion
  const formatted = stringify(pkg, null, 2) + '\n'
  tree.write(packageJsonPath, formatted)
}

/**
 * Creates a summary of the batch update result.
 *
 * @param result - Result object from batch update operation
 * @returns Human-readable summary
 */
export function summarizeBatchUpdate(result: BatchUpdateResult): string {
  const lines = []

  if (result.success) {
    lines.push(`Successfully updated ${result.updated.length} package(s)`)
  } else {
    lines.push(`Updated ${result.updated.length}/${result.total} package(s)`)
    lines.push(`Failed: ${result.failed.length} package(s)`)
  }

  if (result.updated.length > 0) {
    lines.push('')
    lines.push('Updated packages:')
    for (const pkg of result.updated) {
      lines.push(`  ${pkg.name}: ${pkg.previousVersion} -> ${pkg.newVersion}`)
    }
  }

  if (result.failed.length > 0) {
    lines.push('')
    lines.push('Failed packages:')
    for (const pkg of result.failed) {
      lines.push(`  ${pkg.name}: ${pkg.error}`)
    }
  }

  return lines.join('\n')
}
