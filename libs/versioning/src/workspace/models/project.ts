/**
 * Project Model
 *
 * Represents a single project/package within a workspace.
 * Contains package.json data, paths, and dependency information.
 */

import type { PackageJson } from '@hyperfrontend/project-scope'

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
  name: string
  version: string
  path: string
  packageJsonPath: string
  packageJson: PackageJson
  changelogPath?: string | null
  internalDependencies?: readonly string[]
  internalDependents?: readonly string[]
}

/**
 * Creates a new Project object.
 *
 * @param options - Project properties
 * @returns A new Project object
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
 */
export function isPublishable(project: Project): boolean {
  return project.publishable
}

/**
 * Checks if a project is private.
 *
 * @param project - The project to check
 * @returns True if the project is marked as private
 */
export function isPrivate(project: Project): boolean {
  return project.private
}

/**
 * Checks if a project has a changelog file.
 *
 * @param project - The project to check
 * @returns True if changelog exists
 */
export function hasChangelog(project: Project): boolean {
  return project.changelogPath !== null
}

/**
 * Checks if a project has any internal dependencies.
 *
 * @param project - The project to check
 * @returns True if project depends on other workspace packages
 */
export function hasInternalDependencies(project: Project): boolean {
  return project.internalDependencies.length > 0
}

/**
 * Checks if a project has any internal dependents.
 *
 * @param project - The project to check
 * @returns True if other workspace packages depend on this project
 */
export function hasInternalDependents(project: Project): boolean {
  return project.internalDependents.length > 0
}

/**
 * Gets the dependency count (internal dependencies).
 *
 * @param project - Project instance to analyze
 * @returns Number of internal dependencies
 */
export function getDependencyCount(project: Project): number {
  return project.internalDependencies.length
}

/**
 * Gets the dependent count (packages that depend on this one).
 *
 * @param project - Project instance to analyze
 * @returns Number of internal dependents
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
