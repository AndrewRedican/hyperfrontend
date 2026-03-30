import type { PackageJson } from './types'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {from} from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import {createError} from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import {parse} from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import {keys} from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import {createSet} from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Reads and parses a package.json file.
 *
 * @param packageJsonPath - Absolute path to package.json
 * @returns Parsed package.json contents or empty object if not found
 */
function readPackageJson(packageJsonPath: string): PackageJson {
  if (!existsSync(packageJsonPath)) return {}
  return <PackageJson>parse(readFileSync(packageJsonPath, 'utf-8'))
}

/**
 * Checks if a package name is a workspace internal package.
 *
 * @param packageName - Package name to check
 * @returns True if this is a \@hyperfrontend/* workspace package
 */
export function isWorkspacePackage(packageName: string): boolean {
  return packageName.startsWith('@hyperfrontend/')
}

/**
 * Gets external dependencies from a project's package.json.
 *
 * Behavior depends on `bundleWorkspaceDeps`:
 * - false: All dependencies remain external (npm-style), including \@hyperfrontend/*
 * - true: \@hyperfrontend/* workspace packages are bundled/inlined, others remain external
 *
 * Peer dependencies are ALWAYS external regardless of bundleWorkspaceDeps.
 *
 * @param packageJsonPath - Absolute path to package.json
 * @param additionalExternal - Additional packages to mark as external
 * @param bundleWorkspaceDeps - When true, bundle \@hyperfrontend/* packages instead of keeping external
 * @returns Array of external package names
 */
export function getExternalDependencies(packageJsonPath: string, additionalExternal: string[] = [], bundleWorkspaceDeps: boolean): string[] {
  const pkg = readPackageJson(packageJsonPath)

  const deps = keys(pkg.dependencies ?? {})
  const peerDeps = keys(pkg.peerDependencies ?? {})

  // When bundleWorkspaceDeps is true, filter out workspace packages (they'll be bundled)
  // When bundleWorkspaceDeps is false, keep ALL dependencies as external (npm-style)
  const externalRegularDeps = bundleWorkspaceDeps ? deps.filter((dep) => !isWorkspacePackage(dep)) : deps

  const externalAdditional = bundleWorkspaceDeps ? additionalExternal.filter((dep) => !isWorkspacePackage(dep)) : additionalExternal

  // Peer dependencies are ALWAYS external (even workspace packages) since they are optional
  return from(createSet([...externalRegularDeps, ...peerDeps, ...externalAdditional]))
}

/**
 * Creates an external function for Rollup configuration.
 * Marks dependencies in the provided list as external (not bundled).
 *
 * @param external - List of external package names
 * @returns Function that determines if a module ID is external
 */
export function createExternalFn(external: string[]): (id: string) => boolean {
  const externalSet = createSet(external)
  return (id: string): boolean => {
    return externalSet.has(id)
  }
}

/**
 * Validates that all external dependencies have corresponding globals mappings.
 * Throws an error if any external dependency is missing from globals.
 *
 * @param external - List of external package names
 * @param globals - Mapping of package names to global variable names
 * @throws {Error} Error if any external dependency is missing a globals mapping
 */
export function validateExternalsConfig(external: string[] | undefined, globals: Record<string, string> | undefined): void {
  if (!external || external.length === 0) return

  const missingGlobals = external.filter((dep) => !globals?.[dep])
  if (missingGlobals.length > 0) {
    throw createError(
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

  const externalSet = createSet(external)
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
