import { join } from 'node:path'
import { exists, isDirectory, readDirectory, readJsonFileIfExists } from './fs'
import { createRuleLogger } from './logger'

const logger = createRuleLogger('nx-project')

/**
 * Map of Nx target names to their configurations within a project.json file.
 */
export interface ProjectTargets {
  /** Build target configuration */
  build?: unknown
  /** Publish target configuration */
  publish?: unknown
  /** Additional target configurations */
  [key: string]: unknown
}

/**
 * Represents the structure of a project.json file.
 */
export interface ProjectJson {
  /** The type of project - library or application */
  projectType?: 'library' | 'application'
  /** Build targets configuration */
  targets?: ProjectTargets
  /** Tags associated with the project */
  tags?: string[]
  [key: string]: unknown
}

/**
 * Represents the structure of a package.json file.
 */
export interface PackageJson {
  /** Package name */
  name?: string
  /** Package version */
  version?: string
  /** Export map for subpath exports */
  exports?: Record<string, string | Record<string, string>>
  /** Main entry point (CommonJS) */
  main?: string
  /** Module entry point (ESM) */
  module?: string
  /** TypeScript types entry point */
  types?: string
  /** Files to include in package */
  files?: string[]
  /** Workspace package patterns */
  workspaces?: string[]
  [key: string]: unknown
}

/**
 * Represents a publishable library.
 */
export interface PublishableLibrary {
  /** Library name */
  name: string
  /** Root directory path */
  root: string
  /** Project configuration */
  projectJson: ProjectJson
  /** Package configuration, if present */
  packageJson: PackageJson | null
}

/**
 * Checks if the project at the given root is a publishable library.
 *
 * A publishable library must have:
 * - projectType === 'library'
 * - targets.build defined
 * - targets.publish defined
 *
 * @param projectRoot - The root directory of the project.
 * @returns True if the project is a publishable library, false otherwise.
 */
export function isPublishableLibrary(projectRoot: string): boolean {
  logger.debug('Checking if publishable library', { projectRoot })

  const projectJsonPath = join(projectRoot, 'project.json')
  const projectJson = readJsonFileIfExists<ProjectJson>(projectJsonPath)

  if (!projectJson) {
    logger.debug('No project.json found')
    return false
  }

  return isPublishableProjectJson(projectJson)
}

/**
 * Checks if a directory contains a publishable library.
 * Alternative signature that takes the directory path directly.
 *
 * @param projectDir - The directory to check.
 * @returns True if the directory contains a publishable library.
 */
export function isPublishableLibraryDir(projectDir: string): boolean {
  return isPublishableLibrary(projectDir)
}

/**
 * Check if a project.json represents a publishable library.
 *
 * @param projectJson - The parsed project.json content.
 * @returns True if it's a publishable library configuration.
 */
export function isPublishableProjectJson(projectJson: ProjectJson): boolean {
  if (projectJson.projectType !== 'library') {
    return false
  }

  if (!projectJson.targets?.build || !projectJson.targets?.publish) {
    return false
  }

  return true
}

/**
 * Check if a directory looks like a library directory.
 * Checks for common library structure indicators.
 *
 * @param dirPath - Directory path to check.
 * @returns True if it looks like a library directory.
 */
export function looksLikeLibraryDir(dirPath: string): boolean {
  if (!exists(join(dirPath, 'project.json'))) {
    return false
  }

  const hasSrcDir = isDirectory(join(dirPath, 'src'))
  const hasIndexTs = exists(join(dirPath, 'index.ts'))
  const hasMainTs = exists(join(dirPath, 'main.ts'))

  return hasSrcDir || hasIndexTs || hasMainTs
}

/**
 * Find all library directories under a given path.
 * Recursively searches for directories containing project.json
 * with projectType: 'library'.
 *
 * @param searchDir - Directory to search in.
 * @returns Array of absolute paths to library directories.
 */
export function findLibraryDirectories(searchDir: string): string[] {
  logger.debug('Finding library directories', { searchDir })

  const libraries: string[] = []

  if (!isDirectory(searchDir)) {
    return libraries
  }

  const entries = readDirectory(searchDir)

  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist') {
      continue
    }

    const entryPath = join(searchDir, entry)

    if (!isDirectory(entryPath)) {
      continue
    }

    const projectJsonPath = join(entryPath, 'project.json')
    const projectJson = readJsonFileIfExists<ProjectJson>(projectJsonPath)

    if (projectJson?.projectType === 'library') {
      libraries.push(entryPath)
    } else {
      libraries.push(...findLibraryDirectories(entryPath))
    }
  }

  logger.debug('Found library directories', { count: libraries.length })
  return libraries
}

/**
 * Find all publishable library directories under a given path.
 *
 * @param searchDir - Directory to search in.
 * @returns Array of absolute paths to publishable library directories.
 */
export function findPublishableLibraryDirectories(searchDir: string): string[] {
  return findLibraryDirectories(searchDir).filter(isPublishableLibraryDir)
}

/**
 * Get all publishable libraries with their metadata.
 *
 * @param workspaceRoot - Workspace root directory.
 * @param libsDir - Libraries directory (default: 'libs').
 * @returns Array of PublishableLibrary objects.
 */
export function getAllPublishableLibraries(workspaceRoot: string, libsDir = 'libs'): PublishableLibrary[] {
  logger.debug('Getting all publishable libraries', { workspaceRoot, libsDir })

  const libsPath = join(workspaceRoot, libsDir)

  if (!isDirectory(libsPath)) {
    logger.debug('Libs directory does not exist', { libsPath })
    return []
  }

  const libraryDirs = findPublishableLibraryDirectories(libsPath)
  const libraries: PublishableLibrary[] = []

  for (const dir of libraryDirs) {
    const projectJson = readJsonFileIfExists<ProjectJson>(join(dir, 'project.json'))
    const packageJson = readJsonFileIfExists<PackageJson>(join(dir, 'package.json'))

    if (!projectJson) {
      continue
    }

    const name = packageJson?.name ?? dir.split('/').pop() ?? 'unknown'

    libraries.push({
      name,
      root: dir,
      projectJson,
      packageJson,
    })
  }

  logger.debug('Found publishable libraries', { count: libraries.length })
  return libraries
}

/**
 * Read project.json from a directory.
 *
 * @param projectRoot - Project root directory.
 * @returns ProjectJson or null if not found.
 */
export function readProjectJson(projectRoot: string): ProjectJson | null {
  return readJsonFileIfExists<ProjectJson>(join(projectRoot, 'project.json'))
}

/**
 * Read package.json from a directory.
 *
 * @param projectRoot - Project root directory.
 * @returns PackageJson or null if not found.
 */
export function readPackageJson(projectRoot: string): PackageJson | null {
  return readJsonFileIfExists<PackageJson>(join(projectRoot, 'package.json'))
}
