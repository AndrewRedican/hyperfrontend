import type { PackageJson } from '../../project/package'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { exists } from '../../core/fs'
import { join } from '../../core/path'

/**
 * Get combined dependencies from package.json.
 * Merges dependencies, devDependencies, peerDependencies, and optionalDependencies.
 *
 * @param packageJson - The package.json object to extract dependencies from
 * @returns Combined dependencies as a single record
 */
export function collectAllDependencies(packageJson?: PackageJson): Record<string, string> {
  return {
    ...packageJson?.dependencies,
    ...packageJson?.devDependencies,
    ...packageJson?.peerDependencies,
    ...packageJson?.optionalDependencies,
  }
}

/**
 * Extract clean version from dependency version string.
 * Removes semver prefixes like ^, ~, >=, etc.
 * Uses character-by-character parsing to avoid ReDoS vulnerabilities.
 *
 * @param versionString - The version string with optional prefix characters
 * @returns The cleaned version string without prefix characters
 */
export function parseVersionString(versionString?: string): string | undefined {
  if (versionString === undefined || versionString === null) return undefined

  let start = 0
  while (start < versionString.length) {
    const char = versionString[start]
    if (char !== '^' && char !== '~' && char !== '>' && char !== '=' && char !== '<') {
      break
    }
    start++
  }

  return versionString.slice(start)
}

/**
 * Find first matching config file in project.
 * Note: Name avoids similarity to fs.readFile/fs.readFileSync.
 *
 * @param projectPath - The project directory path
 * @param patterns - Array of config file patterns to search for
 * @returns The first matching config file path or undefined
 */
export function locateConfigFile(projectPath: string, patterns: readonly string[]): string | undefined {
  for (const pattern of patterns) {
    const fullPath = join(projectPath, pattern)
    if (exists(fullPath)) {
      return pattern
    }
  }
  return undefined
}

/**
 * Find scripts containing a specific command.
 *
 * @param scripts - The scripts object from package.json
 * @param command - The command string to search for
 * @returns Array of script names that contain the command
 */
export function filterScriptsByCommand(scripts: Record<string, string> | undefined, command: string): string[] {
  if (!scripts) return []
  return entries(scripts)
    .filter(([, script]) => script.includes(command))
    .map(([name]) => name)
}

/**
 * Check if package is in any dependency type.
 *
 * @param packageJson - The package.json object
 * @param packageName - The package name to check
 * @returns True if the package is found in any dependency type
 */
export function hasDependency(packageJson: PackageJson | undefined, packageName: string): boolean {
  const deps = collectAllDependencies(packageJson)
  return packageName in deps
}

/**
 * Get version of a dependency if present.
 *
 * @param packageJson - The package.json object
 * @param packageName - The package name to get the version for
 * @returns The version string without prefix characters, or undefined if not found
 */
export function getDependencyVersion(packageJson: PackageJson | undefined, packageName: string): string | undefined {
  const deps = collectAllDependencies(packageJson)
  return parseVersionString(deps[packageName])
}
