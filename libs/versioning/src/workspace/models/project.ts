import type { PackageJson } from '@hyperfrontend/project-scope/project/package'

/**
 * A single project within a workspace.
 */
export interface Project {
  /** Package name from package.json */
  readonly name: string

  /** Package version from package.json */
  readonly version: string

  /** Absolute path to project root directory */
  readonly path: string

  /** Absolute path to package.json */
  readonly packageJsonPath: string

  /** Parsed package.json content */
  readonly packageJson: PackageJson

  /** Absolute path to CHANGELOG.md (null if not found) */
  readonly changelogPath: string | null

  /** Names of workspace packages this project depends on */
  readonly internalDependencies: readonly string[]

  /** Names of workspace packages that depend on this project */
  readonly internalDependents: readonly string[]

  /** Whether this is a publishable package */
  readonly publishable: boolean

  /** Whether this is a private package */
  readonly private: boolean
}

/**
 * Options for creating a project.
 */
export interface CreateProjectOptions {
  /** Package name */
  name: string
  /** Package version */
  version: string
  /** Absolute path to project root */
  path: string
  /** Absolute path to package.json */
  packageJsonPath: string
  /** Parsed package.json content */
  packageJson: PackageJson
  /** Absolute path to CHANGELOG.md */
  changelogPath?: string | null
  /** Names of workspace packages this project depends on */
  internalDependencies?: readonly string[]
  /** Names of workspace packages that depend on this project */
  internalDependents?: readonly string[]
}

/**
 * Creates a new Project object.
 *
 * @param options - Project properties
 * @returns A new Project object
 *
 * @example
 * ```typescript
 * import { createProject, readPackageJson } from '@hyperfrontend/versioning'
 *
 * const packageJson = readPackageJson('./libs/my-lib/package.json')
 * const project = createProject({
 *   name: '@myorg/my-lib',
 *   version: '1.0.0',
 *   path: './libs/my-lib',
 *   packageJsonPath: './libs/my-lib/package.json',
 *   packageJson,
 *   changelogPath: './libs/my-lib/CHANGELOG.md',
 * })
 * ```
 */
export function createProject(options: CreateProjectOptions): Project {
  const isPrivate = options.packageJson['private'] === true
  const publishable = !isPrivate && options.name !== undefined && options.version !== undefined

  return {
    name: options.name,
    version: options.version,
    path: options.path,
    packageJsonPath: options.packageJsonPath,
    packageJson: options.packageJson,
    changelogPath: options.changelogPath ?? null,
    internalDependencies: options.internalDependencies ?? [],
    internalDependents: options.internalDependents ?? [],
    publishable,
    private: isPrivate,
  }
}

/**
 * Checks if a project is publishable (public and has name/version).
 *
 * @param project - The project to check
 * @returns True if the project can be published
 *
 * @example
 * ```typescript
 * import { discoverProject, isPublishable } from '@hyperfrontend/versioning'
 *
 * const project = discoverProject('./libs/my-lib')
 * if (project && isPublishable(project)) {
 *   console.log(`${project.name} can be published to npm`)
 * }
 * ```
 */
export function isPublishable(project: Project): boolean {
  return project.publishable
}

/**
 * Checks if a project is private.
 *
 * @param project - The project to check
 * @returns True if the project is marked as private
 *
 * @example
 * ```typescript
 * import { discoverProject, isPrivate } from '@hyperfrontend/versioning'
 *
 * const project = discoverProject('./apps/internal-app')
 * if (project && isPrivate(project)) {
 *   console.log('Skipping private package')
 * }
 * ```
 */
export function isPrivate(project: Project): boolean {
  return project.private
}

/**
 * Checks if a project has a changelog file.
 *
 * @param project - The project to check
 * @returns True if changelog exists
 *
 * @example
 * ```typescript
 * import { discoverProject, hasChangelog } from '@hyperfrontend/versioning'
 *
 * const project = discoverProject('./libs/my-lib')
 * if (project && !hasChangelog(project)) {
 *   console.log('Warning: No changelog found for', project.name)
 * }
 * ```
 */
export function hasChangelog(project: Project): boolean {
  return project.changelogPath !== null
}

/**
 * Checks if a project has any internal dependencies.
 *
 * @param project - The project to check
 * @returns True if project depends on other workspace packages
 *
 * @example
 * ```typescript
 * import { discoverProject, hasInternalDependencies } from '@hyperfrontend/versioning'
 *
 * const project = discoverProject('./libs/my-lib')
 * if (project && hasInternalDependencies(project)) {
 *   console.log(`${project.name} depends on:`, project.internalDependencies)
 * }
 * ```
 */
export function hasInternalDependencies(project: Project): boolean {
  return project.internalDependencies.length > 0
}

/**
 * Checks if a project has any internal dependents.
 *
 * @param project - The project to check
 * @returns True if other workspace packages depend on this project
 *
 * @example
 * ```typescript
 * import { discoverProject, hasInternalDependents } from '@hyperfrontend/versioning'
 *
 * const project = discoverProject('./libs/utils')
 * if (project && hasInternalDependents(project)) {
 *   console.log(`${project.name} is used by:`, project.internalDependents)
 * }
 * ```
 */
export function hasInternalDependents(project: Project): boolean {
  return project.internalDependents.length > 0
}

/**
 * Gets the dependency count (internal dependencies).
 *
 * @param project - Project instance to analyze
 * @returns Number of internal dependencies
 *
 * @example
 * ```typescript
 * import { discoverProject, getDependencyCount } from '@hyperfrontend/versioning'
 *
 * const project = discoverProject('./libs/my-lib')
 * if (project) {
 *   console.log(`${project.name} depends on ${getDependencyCount(project)} internal packages`)
 * }
 * ```
 */
export function getDependencyCount(project: Project): number {
  return project.internalDependencies.length
}

/**
 * Gets the dependent count (packages that depend on this one).
 *
 * @param project - Project instance to analyze
 * @returns Number of internal dependents
 *
 * @example
 * ```typescript
 * import { discoverProject, getDependentCount } from '@hyperfrontend/versioning'
 *
 * const project = discoverProject('./libs/utils')
 * if (project) {
 *   console.log(`${project.name} is used by ${getDependentCount(project)} packages`)
 * }
 * ```
 */
export function getDependentCount(project: Project): number {
  return project.internalDependents.length
}

/**
 * Creates a copy of a project with updated internal dependents.
 *
 * @param project - The project to update
 * @param dependents - New list of internal dependents
 * @returns A new Project with updated dependents
 *
 * @example
 * ```typescript
 * import { discoverProject, withDependents } from '@hyperfrontend/versioning'
 *
 * const project = discoverProject('./libs/utils')
 * if (project) {
 *   const updated = withDependents(project, ['@myorg/app', '@myorg/web'])
 *   console.log('Updated dependents:', updated.internalDependents)
 * }
 * ```
 */
export function withDependents(project: Project, dependents: readonly string[]): Project {
  return {
    ...project,
    internalDependents: dependents,
  }
}

/**
 * Creates a copy of a project with an added internal dependent.
 *
 * @param project - The project to update
 * @param dependent - Name of the dependent to add
 * @returns A new Project with the added dependent
 *
 * @example
 * ```typescript
 * import { discoverProject, addDependent } from '@hyperfrontend/versioning'
 *
 * const project = discoverProject('./libs/utils')
 * if (project) {
 *   const updated = addDependent(project, '@myorg/new-app')
 *   console.log('Dependents now:', updated.internalDependents)
 * }
 * ```
 */
export function addDependent(project: Project, dependent: string): Project {
  if (project.internalDependents.includes(dependent)) {
    return project
  }
  return {
    ...project,
    internalDependents: [...project.internalDependents, dependent],
  }
}
