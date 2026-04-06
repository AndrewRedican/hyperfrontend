import { join } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse as parseJson } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createConfigError } from '../../core/errors/structured-errors'
import { readFileContent, readFileIfExists, locateByMarkers } from '../../core/fs'
import { createScopedLogger } from '../../core/logger'

const packageLogger = createScopedLogger('project-scope:project:package')

/**
 * Package.json structure.
 */
export interface PackageJson {
  /** Package name */
  name?: string
  /** Package version */
  version?: string
  /** Package description */
  description?: string
  /** Main entry point */
  main?: string
  /** Module entry point */
  module?: string
  /** Browser entry point */
  browser?: string
  /** Types entry point */
  types?: string
  /** Binary commands */
  bin?: string | Record<string, string>
  /** Scripts */
  scripts?: Record<string, string>
  /** Production dependencies */
  dependencies?: Record<string, string>
  /** Development dependencies */
  devDependencies?: Record<string, string>
  /** Peer dependencies */
  peerDependencies?: Record<string, string>
  /** Optional dependencies */
  optionalDependencies?: Record<string, string>
  /** Workspaces configuration */
  workspaces?:
    | string[]
    | {
        /** Array of workspace glob patterns */
        packages: string[]
      }
  /** Exports map */
  exports?: Record<string, unknown>
  /** Engines */
  engines?: Record<string, string>
  /** Allow additional fields */
  [key: string]: unknown
}

/**
 * Verifies that a value is an object with only string values,
 * used for validating dependency maps and script definitions.
 *
 * @param value - Value to check
 * @returns True if value is a record of strings
 */
function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null) return false
  return values(value).every((v) => typeof v === 'string')
}

/**
 * Extracts and normalizes the workspaces field from package.json,
 * supporting both array format and object with packages array.
 *
 * @param value - Raw workspaces value from package.json
 * @returns Normalized workspace patterns or undefined if invalid
 */
function parseWorkspaces(value: unknown):
  | string[]
  | {
      /** Array of workspace glob patterns */
      packages: string[]
    }
  | undefined {
  if (isArray(value) && value.every((v) => typeof v === 'string')) {
    return <string[]>value
  }
  if (typeof value === 'object' && value !== null) {
    const obj = <Record<string, unknown>>value
    if (isArray(obj['packages'])) {
      return { packages: <string[]>obj['packages'] }
    }
  }
  return undefined
}

/**
 * Validate and normalize package.json data.
 *
 * @param data - Raw parsed data
 * @returns Validated package.json
 */
function validatePackageJson(data: unknown): PackageJson {
  if (typeof data !== 'object' || data === null) {
    throw createError('package.json must be an object')
  }

  const pkg = <Record<string, unknown>>data

  return {
    name: typeof pkg['name'] === 'string' ? pkg['name'] : undefined,
    version: typeof pkg['version'] === 'string' ? pkg['version'] : undefined,
    description: typeof pkg['description'] === 'string' ? pkg['description'] : undefined,
    main: typeof pkg['main'] === 'string' ? pkg['main'] : undefined,
    module: typeof pkg['module'] === 'string' ? pkg['module'] : undefined,
    browser: typeof pkg['browser'] === 'string' ? pkg['browser'] : undefined,
    types: typeof pkg['types'] === 'string' ? pkg['types'] : undefined,
    bin: typeof pkg['bin'] === 'string' || isStringRecord(pkg['bin']) ? <string | Record<string, string>>pkg['bin'] : undefined,
    scripts: isStringRecord(pkg['scripts']) ? pkg['scripts'] : undefined,
    dependencies: isStringRecord(pkg['dependencies']) ? pkg['dependencies'] : undefined,
    devDependencies: isStringRecord(pkg['devDependencies']) ? pkg['devDependencies'] : undefined,
    peerDependencies: isStringRecord(pkg['peerDependencies']) ? pkg['peerDependencies'] : undefined,
    optionalDependencies: isStringRecord(pkg['optionalDependencies']) ? pkg['optionalDependencies'] : undefined,
    workspaces: parseWorkspaces(pkg['workspaces']),
    exports: typeof pkg['exports'] === 'object' ? <Record<string, unknown>>pkg['exports'] : undefined,
    engines: isStringRecord(pkg['engines']) ? pkg['engines'] : undefined,
    ...pkg,
  }
}

/**
 * Reads and parses package.json from a directory, validating
 * the structure and normalizing fields to the PackageJson interface.
 *
 * @param projectPath - Project directory path or path to package.json
 * @returns Parsed package.json
 * @throws {Error} Error if file doesn't exist or is invalid
 */
export function readPackageJson(projectPath: string): PackageJson {
  const packageJsonPath = projectPath.endsWith('package.json') ? projectPath : join(projectPath, 'package.json')
  packageLogger.debug('Reading package.json', { path: packageJsonPath })

  const content = readFileContent(packageJsonPath)

  try {
    const data = parseJson(content)
    const validated = validatePackageJson(data)
    packageLogger.debug('Package.json read successfully', { path: packageJsonPath, name: validated.name })
    return validated
  } catch (error) {
    packageLogger.warn('Failed to parse package.json', {
      path: packageJsonPath,
      error: error instanceof Error ? error.message : String(error),
    })
    throw createConfigError(`Failed to parse package.json: ${packageJsonPath}`, 'CONFIG_PARSE_ERROR', {
      filePath: packageJsonPath,
      cause: error,
    })
  }
}

/**
 * Attempts to read and parse package.json if it exists,
 * returning null on missing file or parse failure.
 *
 * @param projectPath - Project directory path or path to package.json
 * @returns Parsed package.json or null if not found
 */
export function readPackageJsonIfExists(projectPath: string): PackageJson | null {
  const packageJsonPath = projectPath.endsWith('package.json') ? projectPath : join(projectPath, 'package.json')

  const content = readFileIfExists(packageJsonPath)
  if (!content) {
    packageLogger.debug('Package.json not found', { path: packageJsonPath })
    return null
  }

  try {
    const validated = validatePackageJson(parseJson(content))
    packageLogger.debug('Package.json loaded', { path: packageJsonPath, name: validated.name })
    return validated
  } catch {
    packageLogger.debug('Failed to parse package.json, returning null', { path: packageJsonPath })
    return null
  }
}

/**
 * Find nearest package.json by walking up the directory tree.
 *
 * @param startPath - Starting path
 * @returns Path to directory containing package.json, or null if not found
 */
export function findNearestPackageJson(startPath: string): string | null {
  return locateByMarkers(startPath, ['package.json'])
}
