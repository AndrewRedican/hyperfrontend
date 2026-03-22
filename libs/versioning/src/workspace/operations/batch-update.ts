/**
 * Batch Update
 *
 * Utilities for updating multiple packages at once.
 * Supports updating versions, dependencies, and other package.json fields.
 *
 * All operations use the VFS (Virtual File System) Tree abstraction,
 * buffering changes until explicitly committed via `commitChanges()`.
 */

import type { Tree } from '@hyperfrontend/project-scope'
import type { Workspace } from '../models/workspace'
import type { PlannedBump } from './cascade-bump'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { changeJsonFile } from '../../utils/change-json-file'

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
  /** Whether to update dependency references in other packages */
  updateDependencyReferences?: boolean
}

/**
 * Default batch update options.
 */
export const DEFAULT_BATCH_UPDATE_OPTIONS: Required<BatchUpdateOptions> = {
  updateDependencyReferences: true,
}

/**
 * Applies planned bumps to the workspace using the VFS Tree.
 * Updates package.json version fields for all affected packages.
 *
 * Changes are buffered in the tree until `commitChanges()` is called,
 * enabling atomic commits and rollback on failure.
 *
 * @param tree - Virtual file system tree for buffered operations
 * @param workspace - Workspace containing projects to update
 * @param bumps - Planned version bumps
 * @param options - Update options
 * @returns Batch update result
 *
 * @example
 * ```typescript
 * import { createTree, commitChanges } from '@hyperfrontend/project-scope'
 * import { applyBumps, calculateCascadeBumps } from '@hyperfrontend/versioning'
 *
 * const tree = createTree(workspaceRoot)
 * const cascadeResult = calculateCascadeBumps(workspace, directBumps)
 * const updateResult = applyBumps(tree, workspace, cascadeResult.bumps)
 *
 * if (updateResult.success) {
 *   commitChanges(tree) // Atomic commit of all changes
 *   console.log(`Updated ${updateResult.updated.length} packages`)
 * } else {
 *   console.error('Some updates failed:', updateResult.failed)
 *   // No commitChanges() call - changes are discarded
 * }
 * ```
 */
export function applyBumps(
  tree: Tree,
  workspace: Workspace,
  bumps: readonly PlannedBump[],
  options: BatchUpdateOptions = {}
): BatchUpdateResult {
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
      updatePackageVersionInTree(tree, project.packageJsonPath, bump.nextVersion)

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
  if (opts.updateDependencyReferences) {
    for (const project of workspace.projectList) {
      try {
        updateDependencyReferencesInTree(tree, project.packageJsonPath, versionUpdates)
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
 * @throws {Error} If the file doesn't exist
 */
export function updatePackageVersionInTree(tree: Tree, packageJsonPath: string, newVersion: string): void {
  changeJsonFile<{ version: string }>(tree, packageJsonPath, (pkg) => {
    pkg.version = newVersion
    return pkg
  })
}

/**
 * Updates dependency version references in a package.json file using a VFS Tree.
 *
 * Uses the `changeFile()` pattern for cleaner transformation.
 * Silently skips if the file doesn't exist.
 *
 * @param tree - Virtual file system tree
 * @param packageJsonPath - Relative path to package.json
 * @param versionUpdates - Map of package name to new version
 */
export function updateDependencyReferencesInTree(tree: Tree, packageJsonPath: string, versionUpdates: Map<string, string>): void {
  // Skip if file doesn't exist (preserve silent failure behavior)
  if (!tree.exists(packageJsonPath)) return

  type PackageJson = {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
  }

  // Check if any dependencies need to be updated before modifying
  const content = tree.read(packageJsonPath, 'utf-8')
  if (!content) return

  const pkg = <PackageJson>parse(content)
  const depTypes = <const>['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

  let hasMatchingDeps = false
  for (const depType of depTypes) {
    const deps = pkg[depType]
    if (deps) {
      for (const [name] of versionUpdates) {
        if (deps[name]) {
          hasMatchingDeps = true
          break
        }
      }
    }
    if (hasMatchingDeps) break
  }

  // Only write if there are matching dependencies to update
  if (!hasMatchingDeps) return

  changeJsonFile<PackageJson>(tree, packageJsonPath, (pkg) => {
    for (const depType of depTypes) {
      const deps = pkg[depType]
      if (deps) {
        for (const [name, newVersion] of versionUpdates) {
          if (deps[name]) {
            // Preserve version prefix (^, ~, etc.) or use exact version
            const currentRange = deps[name]
            const prefix = extractVersionPrefix(currentRange)
            deps[name] = prefix + newVersion
          }
        }
      }
    }

    return pkg
  })
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
