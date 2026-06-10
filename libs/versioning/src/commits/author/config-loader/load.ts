import type { PartialSessionConfig } from '../models/session-config'
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/** Supported config file names, searched in this order per directory. */
export const CONFIG_FILE_NAMES: readonly string[] = ['commit.config.js', 'commit.config.mjs', 'commit.config.cjs']

/** Inputs accepted by `loadCommitConfig`. */
export interface LoadCommitConfigOptions {
  /** Directory to start the upward search from */
  readonly cwd: string

  /** Explicit override path from `--config <path>` — resolved against `cwd` when relative */
  readonly overridePath?: string
}

/** Return shape of `loadCommitConfig`. */
export interface LoadedCommitConfig {
  /** Resolved configuration (empty object when no config was found) */
  readonly config: PartialSessionConfig

  /** Absolute path of the config file that was loaded (undefined when nothing was found) */
  readonly sourcePath?: string
}

/** Module namespace returned by `await import(configUrl)` — ESM shape with optional CJS interop. */
interface ImportedConfigModule extends Record<string, unknown> {
  /** Default export when the config uses `export default` (ESM) or `module.exports` (CJS interop) */
  readonly default?: unknown
}

/** Minimal row shape checked by `isTypeArray` before the caller casts to `SessionType[]`. */
interface TypeArrayEntry {
  /** Bare identifier (e.g. `feat`, `fix`) */
  readonly name: unknown
}

/**
 * Loads the user's commit config. Resolution:
 *   1. `overridePath` wins when set
 *   2. Otherwise walk upward from `cwd` looking for one of `CONFIG_FILE_NAMES`
 *      until a workspace boundary marker (`.git`, `pnpm-workspace.yaml`) is hit
 *   3. Missing config is not an error — `config` becomes `{}`
 *
 * @param options - Search inputs
 * @returns Loaded partial config plus the file it came from (if any)
 *
 * @example Auto-discovery from cwd
 * ```typescript
 * const { config, sourcePath } = await loadCommitConfig({ cwd: process.cwd() })
 * ```
 */
export async function loadCommitConfig(options: LoadCommitConfigOptions): Promise<LoadedCommitConfig> {
  const resolvedPath = options.overridePath ? resolveOverride(options.cwd, options.overridePath) : discoverConfig(options.cwd)
  if (resolvedPath === null) return { config: {} }

  const config = await importConfigModule(resolvedPath)
  validateConfigShape(config, resolvedPath)

  return { config, sourcePath: resolvedPath }
}

/** Filenames that stop the upward search (prevents escaping a workspace). */
const BOUNDARY_MARKERS: readonly string[] = ['.git', 'pnpm-workspace.yaml']

/**
 * Resolves an explicit `--config` override relative to the caller's cwd, then
 * asserts that the file exists.
 *
 * @param cwd - Base directory used when `overridePath` is relative
 * @param overridePath - User-supplied path from the command line
 * @returns Absolute path to the override file
 */
function resolveOverride(cwd: string, overridePath: string): string {
  const absolute = isAbsolute(overridePath) ? overridePath : resolve(cwd, overridePath)
  if (!existsSync(absolute)) {
    throw createError(`Config file not found: ${absolute}`)
  }
  return absolute
}

/**
 * Walks upward from `cwd` looking for the first recognized config file. Stops
 * at a workspace boundary marker or the filesystem root.
 *
 * @param cwd - Starting directory
 * @returns Absolute path to the discovered config, or null when none is found
 */
function discoverConfig(cwd: string): string | null {
  let current = cwd
  while (true) {
    for (const name of CONFIG_FILE_NAMES) {
      const candidate = join(current, name)
      if (existsSync(candidate)) return candidate
    }
    if (isBoundary(current)) return null
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

/**
 * Tests whether the given directory holds a workspace boundary marker.
 *
 * @param directory - Directory to inspect
 * @returns True when a boundary marker is present
 */
function isBoundary(directory: string): boolean {
  for (const marker of BOUNDARY_MARKERS) {
    if (existsSync(join(directory, marker))) return true
  }
  return false
}

/**
 * Dynamically imports the resolved config file and returns the default export
 * (falling back to the module namespace for CJS interop).
 *
 * @param absolutePath - Absolute path to the config module
 * @returns Exported partial session config
 */
async function importConfigModule(absolutePath: string): Promise<PartialSessionConfig> {
  const url = pathToFileURL(absolutePath).href
  const imported = <ImportedConfigModule>await import(url)
  const exported = imported.default ?? imported
  if (exported === null || typeof exported !== 'object') {
    throw createError(`Config at ${absolutePath} must export an object`)
  }
  return <PartialSessionConfig>exported
}

/**
 * Light structural validation so callers fail loudly on typo'd keys rather
 * than silently dropping them into `resolveSessionConfig`.
 *
 * @param config - Partial config returned from the user module
 * @param sourcePath - Absolute path used in error messages
 */
function validateConfigShape(config: PartialSessionConfig, sourcePath: string): void {
  if (config.headerMaxLength !== undefined && config.headerMaxLength !== null && typeof config.headerMaxLength !== 'number') {
    throw createError(`${sourcePath}: \`headerMaxLength\` must be number | null`)
  }
  if (config.types !== undefined && !isTypeArray(config.types)) {
    throw createError(`${sourcePath}: \`types\` must be an array of { name, description? }`)
  }
}

/**
 * Narrows `unknown` to the `SessionType[]` shape expected by `SessionConfig`.
 *
 * @param value - Candidate value loaded from the config module
 * @returns True when every entry satisfies the `{ name: string }` contract
 */
function isTypeArray(value: unknown): value is readonly TypeArrayEntry[] {
  if (!isArray(value)) return false
  return (<unknown[]>value).every(
    (entry) => typeof entry === 'object' && entry !== null && 'name' in entry && typeof (<TypeArrayEntry>entry).name === 'string'
  )
}
