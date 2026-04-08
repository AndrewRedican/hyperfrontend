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
 *
 * @example
 * ```typescript
 * import { collectAllDependencies } from '@hyperfrontend/project-scope'
 *
 * const allDeps = collectAllDependencies(packageJson)
 * // => { 'react': '^18.0.0', 'typescript': '^5.0.0', ... }
 * ```
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
 *
 * @example
 * ```typescript
 * import { parseVersionString } from '@hyperfrontend/project-scope'
 *
 * parseVersionString('^1.2.3')   // => '1.2.3'
 * parseVersionString('~2.0.0')   // => '2.0.0'
 * parseVersionString('>=3.0.0')  // => '3.0.0'
 * ```
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
 *
 * @example
 * ```typescript
 * import { locateConfigFile } from '@hyperfrontend/project-scope'
 *
 * const eslintConfig = locateConfigFile('/project', ['.eslintrc', '.eslintrc.js', 'eslint.config.js'])
 * // => '.eslintrc.js'
 * ```
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
 *
 * @example
 * ```typescript
 * import { filterScriptsByCommand } from '@hyperfrontend/project-scope'
 *
 * const jestScripts = filterScriptsByCommand(pkg.scripts, 'jest')
 * // => ['test', 'test:watch', 'test:coverage']
 * ```
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
 *
 * @example
 * ```typescript
 * import { hasDependency } from '@hyperfrontend/project-scope'
 *
 * if (hasDependency(packageJson, 'typescript')) {
 *   console.log('TypeScript is installed')
 * }
 * ```
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
 *
 * @example
 * ```typescript
 * import { getDependencyVersion } from '@hyperfrontend/project-scope'
 *
 * const reactVersion = getDependencyVersion(packageJson, 'react')
 * // => '18.2.0'
 * ```
 */
export function getDependencyVersion(packageJson: PackageJson | undefined, packageName: string): string | undefined {
  const deps = collectAllDependencies(packageJson)
  return parseVersionString(deps[packageName])
}
