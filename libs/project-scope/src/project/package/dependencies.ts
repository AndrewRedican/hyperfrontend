import type { PackageJson } from './read'
import { join } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { readPackageJsonIfExists } from './read'

/**
 * Map of dependency name to version.
 */
export type DependencyMap = Record<string, string>

/**
 * All dependencies categorized.
 */
export interface AllDependencies {
  /** Production dependencies */
  dependencies: DependencyMap
  /** Development dependencies */
  devDependencies: DependencyMap
  /** Peer dependencies */
  peerDependencies: DependencyMap
  /** Optional dependencies */
  optionalDependencies: DependencyMap
}

/**
 * Extract all dependencies from package.json.
 *
 * @param packageJson - Parsed package.json
 * @returns All dependencies categorized
 */
export function getDependencies(packageJson: PackageJson): AllDependencies {
  return {
    dependencies: packageJson.dependencies ?? {},
    devDependencies: packageJson.devDependencies ?? {},
    peerDependencies: packageJson.peerDependencies ?? {},
    optionalDependencies: packageJson.optionalDependencies ?? {},
  }
}

/**
 * Get production dependencies only.
 *
 * @param packageJson - Parsed package.json
 * @returns Map of dependency name to version for runtime dependencies
 */
export function getProductionDependencies(packageJson: PackageJson): DependencyMap {
  return packageJson.dependencies ?? {}
}

/**
 * Get development dependencies only.
 *
 * @param packageJson - Parsed package.json
 * @returns Map of dependency name to version for dev-time dependencies
 */
export function getDevDependencies(packageJson: PackageJson): DependencyMap {
  return packageJson.devDependencies ?? {}
}

/**
 * Get peer dependencies only.
 *
 * @param packageJson - Parsed package.json
 * @returns Map of dependency name to version for peer requirements
 */
export function getPeerDependencies(packageJson: PackageJson): DependencyMap {
  return packageJson.peerDependencies ?? {}
}

/**
 * Get all dependencies merged into a single map.
 *
 * @param packageJson - Parsed package.json
 * @returns All dependencies merged
 */
export function getAllDependencies(packageJson: PackageJson): DependencyMap {
  return {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
    ...packageJson.optionalDependencies,
  }
}

/**
 * Check if package has a dependency of any type.
 *
 * @param packageJson - Parsed package.json content
 * @param name - Name of the dependency to check
 * @param depTypes - Optional array of dependency types to check (defaults to all)
 * @returns True if dependency exists in specified categories
 */
export function hasDependency(
  packageJson: PackageJson,
  name: string,
  depTypes?: ('dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies')[]
): boolean {
  const typesToCheck = depTypes ?? ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

  for (const depType of typesToCheck) {
    if (packageJson[depType] && name in <DependencyMap>packageJson[depType]) {
      return true
    }
  }

  return false
}

/**
 * Get version string of a specific dependency.
 *
 * @param packageJson - Parsed package.json content
 * @param name - Name of the dependency to look up
 * @returns Version string or null if not found
 */
export function getDependencyVersion(packageJson: PackageJson, name: string): string | null {
  const deps = getDependencies(packageJson)
  return deps.dependencies[name] ?? deps.devDependencies[name] ?? deps.peerDependencies[name] ?? deps.optionalDependencies[name] ?? null
}

/**
 * Get workspace patterns from package.json.
 *
 * @param packageJson - Parsed package.json
 * @returns Array of workspace patterns or empty array
 */
export function getWorkspaces(packageJson: PackageJson): string[] {
  if (!packageJson.workspaces) return []

  if (isArray(packageJson.workspaces)) {
    return packageJson.workspaces
  }

  if (typeof packageJson.workspaces === 'object' && 'packages' in packageJson.workspaces) {
    return packageJson.workspaces.packages
  }

  return []
}

/**
 * Check if package has workspaces configured (monorepo).
 *
 * @param packageJson - Parsed package.json
 * @returns True if workspaces are defined
 */
export function hasWorkspaces(packageJson: PackageJson): boolean {
  return getWorkspaces(packageJson).length > 0
}

/**
 * Check if a package is installed in node_modules.
 *
 * @param projectPath - Project root directory
 * @param packageName - Package name to check
 * @returns Boolean indicating whether the package exists in node_modules
 */
export function hasInstalledPackage(projectPath: string, packageName: string): boolean {
  const pkgPath = join(projectPath, 'node_modules', packageName, 'package.json')
  return readPackageJsonIfExists(pkgPath) !== null
}

/**
 * Get installed package version from node_modules.
 *
 * @param projectPath - Project root directory
 * @param packageName - Name of the npm package to look up
 * @returns Installed version or null if not found
 */
export function getInstalledVersion(projectPath: string, packageName: string): string | null {
  const pkg = readPackageJsonIfExists(join(projectPath, 'node_modules', packageName, 'package.json'))
  return pkg?.version ?? null
}
