import type { BumpType, SemVer } from '../../semver/models/version'
import type { Project } from '../models/project'
import type { Workspace } from '../models/workspace'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { format } from '../../semver/format/to-string'
import { increment } from '../../semver/increment/bump'
import { parseVersion } from '../../semver/parse/version'
import { getTransitiveDependents } from '../discovery/dependencies'

/**
 * A planned version bump for a package.
 */
export interface PlannedBump {
  /** Package name */
  readonly name: string

  /** Current version */
  readonly currentVersion: string

  /** Next version after bump */
  readonly nextVersion: string

  /** Type of bump */
  readonly bumpType: BumpType

  /** Reason for the bump */
  readonly reason: BumpReason

  /** Packages that triggered this bump (for cascade bumps) */
  readonly triggeredBy: readonly string[]
}

/**
 * Reason for a version bump.
 */
export type BumpReason = 'direct' | 'cascade' | 'sync'

/**
 * Options for cascade bump calculation.
 */
export interface CascadeBumpOptions {
  /**
   * Bump type for cascaded dependents.
   * Default is 'patch' - dependents get a patch bump when their dependencies change.
   */
  cascadeBumpType?: BumpType

  /**
   * Whether to include dev dependencies in cascade.
   * Default is false - only production dependencies trigger cascades.
   */
  includeDevDependencies?: boolean

  /**
   * Whether to include peer dependencies in cascade.
   * Default is true - peer dependency updates should cascade.
   */
  includePeerDependencies?: boolean

  /**
   * Custom prerelease identifier for prerelease bumps.
   */
  prereleaseId?: string
}

/**
 * Default cascade bump options.
 */
export const DEFAULT_CASCADE_OPTIONS: Required<CascadeBumpOptions> = {
  cascadeBumpType: 'patch',
  includeDevDependencies: false,
  includePeerDependencies: true,
  prereleaseId: 'alpha',
}

/**
 * Result of cascade bump calculation.
 */
export interface CascadeBumpResult {
  /** All planned bumps, in topological order */
  readonly bumps: readonly PlannedBump[]

  /** Packages explicitly bumped (direct changes) */
  readonly directBumps: readonly PlannedBump[]

  /** Packages bumped due to cascading */
  readonly cascadeBumps: readonly PlannedBump[]

  /** Total number of packages affected */
  readonly totalAffected: number
}

/**
 * Input for calculating cascade bumps.
 */
export interface DirectBumpInput {
  /** Package name */
  name: string

  /** Type of bump */
  bumpType: BumpType
}

/**
 * Calculates cascade bumps for a workspace given direct bumps.
 *
 * When packages are directly bumped (e.g., due to commits), their dependents
 * may also need version bumps. This function calculates all affected packages.
 *
 * @param workspace - Workspace containing projects and dependency graph
 * @param directBumps - Packages with direct changes
 * @param options - Configuration for cascade bump calculation
 * @returns Cascade bump result
 *
 * @example
 * ```typescript
 * import { calculateCascadeBumps } from '@hyperfrontend/versioning'
 *
 * // If lib-utils is getting a minor bump
 * const result = calculateCascadeBumps(workspace, [
 *   { name: 'lib-utils', bumpType: 'minor' }
 * ])
 *
 * // result.bumps includes lib-utils and all packages that depend on it
 * for (const bump of result.bumps) {
 *   console.log(`${bump.name}: ${bump.currentVersion} -> ${bump.nextVersion}`)
 * }
 * ```
 */
export function calculateCascadeBumps(
  workspace: Workspace,
  directBumps: readonly DirectBumpInput[],
  options: CascadeBumpOptions = {}
): CascadeBumpResult {
  const opts = { ...DEFAULT_CASCADE_OPTIONS, ...options }
  const directBumpMap = createMap(directBumps.map((b) => <[string, DirectBumpInput]>[b.name, b]))
  const allBumps = createMap<string, PlannedBump>()

  for (const input of directBumps) {
    const project = workspace.projects.get(input.name)
    if (!project) {
      continue
    }

    const planned = createPlannedBump(project, input.bumpType, 'direct', [], opts.prereleaseId)
    allBumps.set(input.name, planned)
  }

  const processed = createSet<string>()
  const queue = [...directBumps.map((b) => b.name)]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined || processed.has(current)) {
      continue
    }
    processed.add(current)

    const dependents = getTransitiveDependents(workspace, current)

    for (const depName of dependents) {
      if (directBumpMap.has(depName)) {
        continue
      }

      if (allBumps.has(depName)) {
        const existing = allBumps.get(depName)
        if (existing && !existing.triggeredBy.includes(current)) {
          allBumps.set(depName, {
            ...existing,
            triggeredBy: [...existing.triggeredBy, current],
          })
        }
        continue
      }

      const project = workspace.projects.get(depName)
      if (!project) {
        continue
      }

      if (!shouldCascade(workspace, depName, current, opts)) {
        continue
      }

      const planned = createPlannedBump(project, opts.cascadeBumpType, 'cascade', [current], opts.prereleaseId)
      allBumps.set(depName, planned)

      queue.push(depName)
    }
  }

  const bumps = [...allBumps.values()]
  const directBumpsArray = bumps.filter((b) => b.reason === 'direct')
  const cascadeBumpsArray = bumps.filter((b) => b.reason === 'cascade')

  bumps.sort((a, b) => a.name.localeCompare(b.name))

  return {
    bumps,
    directBumps: directBumpsArray,
    cascadeBumps: cascadeBumpsArray,
    totalAffected: bumps.length,
  }
}

/**
 * Determines if a cascade should propagate based on dependency type.
 *
 * @param workspace - Workspace containing the project
 * @param dependent - Name of the dependent package
 * @param dependency - Name of the dependency being bumped
 * @param opts - Cascade bump options
 * @returns True if the bump should cascade to this dependent
 */
function shouldCascade(workspace: Workspace, dependent: string, dependency: string, opts: Required<CascadeBumpOptions>): boolean {
  const project = workspace.projects.get(dependent)
  if (!project) {
    return false
  }

  const pkg = project.packageJson

  if (pkg.dependencies?.[dependency]) {
    return true
  }

  if (opts.includeDevDependencies && pkg.devDependencies?.[dependency]) {
    return true
  }

  if (opts.includePeerDependencies && pkg.peerDependencies?.[dependency]) {
    return true
  }

  return false
}

/**
 * Creates a planned bump for a project.
 *
 * @param project - Project to create bump plan for
 * @param bumpType - Type of version bump to apply
 * @param reason - Reason for the bump (direct, cascade, or sync)
 * @param triggeredBy - List of packages that triggered this bump
 * @param prereleaseId - Optional prerelease identifier
 * @returns Planned bump object with version information
 */
function createPlannedBump(
  project: Project,
  bumpType: BumpType,
  reason: BumpReason,
  triggeredBy: string[],
  prereleaseId?: string
): PlannedBump {
  const parseResult = parseVersion(project.version)
  if (!parseResult.success || !parseResult.version) {
    throw createError(`Invalid version for ${project.name}: ${project.version}`)
  }

  const next = computeNextVersion(parseResult.version, bumpType, prereleaseId)

  return {
    name: project.name,
    currentVersion: project.version,
    nextVersion: format(next),
    bumpType,
    reason,
    triggeredBy,
  }
}

/**
 * Computes the next version based on bump type.
 *
 * @param current - Current semantic version
 * @param bumpType - Type of version bump to apply
 * @param prereleaseId - Optional prerelease identifier
 * @returns New semantic version after bump
 */
function computeNextVersion(current: SemVer, bumpType: BumpType, prereleaseId?: string): SemVer {
  if (bumpType === 'none') {
    return current
  }

  return increment(current, bumpType, prereleaseId)
}

/**
 * Calculates cascade bumps starting from a single package.
 *
 * @param workspace - Workspace containing projects and dependency graph
 * @param packageName - Package with direct changes
 * @param bumpType - Type of bump for the direct change
 * @param options - Configuration for cascade behavior
 * @returns Cascade bump result
 *
 * @example
 * ```typescript
 * import { discoverWorkspace, calculateCascadeBumpsFromPackage } from '@hyperfrontend/versioning'
 *
 * const workspace = discoverWorkspace()
 * const result = calculateCascadeBumpsFromPackage(workspace, '@myorg/utils', 'minor')
 *
 * console.log(`${result.totalAffected} packages will be bumped`)
 * for (const bump of result.bumps) {
 *   console.log(`${bump.name}: ${bump.currentVersion} -> ${bump.nextVersion}`)
 * }
 * ```
 */
export function calculateCascadeBumpsFromPackage(
  workspace: Workspace,
  packageName: string,
  bumpType: BumpType,
  options: CascadeBumpOptions = {}
): CascadeBumpResult {
  return calculateCascadeBumps(workspace, [{ name: packageName, bumpType }], options)
}

/**
 * Gets a summary of the cascade bump calculation.
 *
 * @param result - Result object from cascade bump calculation
 * @returns Human-readable summary
 *
 * @example
 * ```typescript
 * import { calculateCascadeBumps, summarizeCascadeBumps } from '@hyperfrontend/versioning'
 *
 * const result = calculateCascadeBumps(workspace, [{ name: '@myorg/utils', bumpType: 'patch' }])
 * console.log(summarizeCascadeBumps(result))
 * // Output:
 * // 3 package(s) affected:
 * //   - 1 direct bump(s)
 * //   - 2 cascade bump(s)
 * ```
 */
export function summarizeCascadeBumps(result: CascadeBumpResult): string {
  if (result.totalAffected === 0) {
    return 'No packages affected'
  }

  const lines = []
  lines.push(`${result.totalAffected} package(s) affected:`)
  lines.push(`  - ${result.directBumps.length} direct bump(s)`)
  lines.push(`  - ${result.cascadeBumps.length} cascade bump(s)`)
  lines.push('')
  lines.push('Planned bumps:')

  for (const bump of result.bumps) {
    const suffix = bump.reason === 'cascade' ? ` (triggered by ${bump.triggeredBy.join(', ')})` : ''
    lines.push(`  ${bump.name}: ${bump.currentVersion} -> ${bump.nextVersion} [${bump.bumpType}]${suffix}`)
  }

  return lines.join('\n')
}
