import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PackageJson } from './types'

/**
 * Reads and parses a package.json file.
 *
 * @param packageJsonPath - Absolute path to package.json
 * @returns Parsed package.json contents or empty object if not found
 */
function readPackageJson(packageJsonPath: string): PackageJson {
  if (!existsSync(packageJsonPath)) return {}
  return <PackageJson>JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
}

/**
 * Gets external dependencies from a project's package.json.
 * Includes both dependencies and peerDependencies.
 *
 * @param packageJsonPath - Absolute path to package.json
 * @param additionalExternal - Additional packages to mark as external
 * @returns Array of external package names
 */
export function getExternalDependencies(packageJsonPath: string, additionalExternal: string[] = []): string[] {
  const pkg = readPackageJson(packageJsonPath)

  const deps = Object.keys(pkg.dependencies ?? {})
  const peerDeps = Object.keys(pkg.peerDependencies ?? {})

  const external = new Set<string>([...deps, ...peerDeps, ...additionalExternal])

  return Array.from(external)
}

/**
 * Creates an external function for Rollup configuration.
 * Marks dependencies, peerDependencies, and \@hyperfrontend/* packages as external.
 *
 * @param external - List of external package names
 * @returns Function that determines if a module ID is external
 */
export function createExternalFn(external: string[]): (id: string) => boolean {
  return (id: string): boolean => {
    if (external.includes(id)) return true
    if (id.startsWith('@hyperfrontend/')) return true
    return false
  }
}

/**
 * Validates that all external dependencies have corresponding globals mappings.
 * Throws an error if any external dependency is missing from globals.
 *
 * @param external - List of external package names
 * @param globals - Mapping of package names to global variable names
 * @throws Error if any external dependency is missing a globals mapping
 */
export function validateExternalsConfig(external: string[] | undefined, globals: Record<string, string> | undefined): void {
  if (!external || external.length === 0) return

  const missingGlobals = external.filter((dep) => !globals?.[dep])
  if (missingGlobals.length > 0) {
    throw new Error(
      `IIFE/UMD build failed: Missing globals mapping for external dependencies:\n` +
        missingGlobals.map((d) => `  - ${d}`).join('\n') +
        `\n\nAdd globals mapping or remove from external list to inline.`
    )
  }
}

/**
 * Creates an external function for bundle builds (IIFE/UMD).
 * When external is provided, only those dependencies are external.
 * When external is omitted, all dependencies are inlined.
 *
 * @param external - Explicit list of external dependencies. If omitted, all are inlined.
 * @returns Function that determines if a module ID is external
 */
export function createBundleExternalFn(external: string[] | undefined): (id: string) => boolean {
  if (!external || external.length === 0) {
    return () => false
  }

  const externalSet = new Set<string>(external)
  return (id: string): boolean => externalSet.has(id)
}

/**
 * Gets the path to a project's package.json.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Absolute path to package.json
 */
export function getPackageJsonPath(projectRoot: string): string {
  return join(projectRoot, 'package.json')
}
