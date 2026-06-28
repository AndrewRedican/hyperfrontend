import type { CliFlags } from '../cli/args'
import type { DevAppConfig, DevConfig } from '../shared/types'
import { dirname, isAbsolute, resolve } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { DEV_CONFIG_BASENAME, discoverConfigFile } from '../cli/config/discover'
import { loadModuleFile } from '../cli/config/load-module'

// note: Default debug-UI port; app ports auto-assign from APP_PORT_BASE so each app gets a distinct origin for cross-origin testing.
const DEFAULT_DEBUG_PORT = 4280

// note: First auto-assigned app port; the nth unported app listens on APP_PORT_BASE + n.
const APP_PORT_BASE = 3000

/** A single dev-server app with its serving directory and port resolved to concrete values. */
export interface ResolvedDevApp {
  /** App name, matched against the feature name. */
  readonly name: string
  /** Absolute directory the built app is served from. */
  readonly outputDir: string
  /** Port the app's static server listens on. */
  readonly port: number
}

/** Fully-resolved debug-UI toggles with every option defaulted. */
export interface ResolvedDevDebug {
  /** Whether the debug UI is served at all. */
  readonly enabled: boolean
  /** Whether the message-log panel is shown. */
  readonly messageLog: boolean
  /** Whether the security-inspector panel is shown. */
  readonly securityView: boolean
}

/** A fully-resolved `hf-dev.config.*`: concrete app servers plus debug settings. */
export interface ResolvedDevConfig {
  /** The app static servers to start. */
  readonly apps: readonly ResolvedDevApp[]
  /** The resolved debug-UI toggles. */
  readonly debug: ResolvedDevDebug
  /** Port the debug-UI control server listens on. */
  readonly debugPort: number
  /** Absolute path of the config file that was loaded. */
  readonly sourcePath: string
}

/** Injectable boundaries for {@link resolveDevConfig}, defaulted for production. */
export interface ResolveDevConfigDeps {
  /** Loads a resolved config or apps file. */
  readonly loadConfig?: (absolutePath: string) => Promise<unknown>
  /** Discovers the dev-server config file under a directory. */
  readonly discover?: (directory: string, baseName: string) => string | null
}

/** Inputs for {@link resolveDevConfig}. */
export interface ResolveDevConfigOptions extends ResolveDevConfigDeps {
  /** Working directory the config and apps paths resolve against. */
  readonly cwd: string
  /** Parsed CLI flags, applied with the highest precedence. */
  readonly flags: CliFlags
}

/**
 * Narrows an unknown value to a plain record.
 *
 * @param value - The value to test.
 * @returns `true` when the value is a non-null, non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !isArray(value)
}

/**
 * Resolves a possibly-relative path against a base directory.
 *
 * @param base - Absolute base directory.
 * @param path - The path to resolve.
 * @returns The absolute path.
 */
function toAbsolute(base: string, path: string): string {
  return isAbsolute(path) ? path : resolve(base, path)
}

/**
 * Validates one app entry, asserting `name`/`outputDir` strings and an optional numeric `port`.
 *
 * @param value - The candidate app entry.
 * @param index - The entry's index, used to locate problems in the error message.
 * @param sourcePath - The file the entry came from, used in the error message.
 * @returns The validated app entry.
 * @throws {Error} When a required field is missing or mistyped.
 *
 * @example Validating a single app entry
 * ```typescript
 * const app = validateDevApp({ name: 'clock', outputDir: './dist' }, 0, '/p/hf-dev.config.json')
 * ```
 */
export function validateDevApp(value: unknown, index: number, sourcePath: string): DevAppConfig {
  if (!isRecord(value)) {
    throw createError(`${sourcePath}: apps[${index}] must be an object.`)
  }
  if (typeof value['name'] !== 'string' || value['name'].length === 0) {
    throw createError(`${sourcePath}: apps[${index}].name must be a non-empty string.`)
  }
  if (typeof value['outputDir'] !== 'string' || value['outputDir'].length === 0) {
    throw createError(`${sourcePath}: apps[${index}].outputDir must be a non-empty string.`)
  }
  if (value['port'] !== undefined && !isPort(value['port'])) {
    throw createError(`${sourcePath}: apps[${index}].port must be an integer between 1 and 65535.`)
  }
  return <DevAppConfig>(<unknown>value)
}

/**
 * Validates an unknown value as a dev-server apps array.
 *
 * @param value - The candidate apps array.
 * @param sourcePath - The file the array came from, used in error messages.
 * @returns The validated, non-empty apps array.
 * @throws {Error} When the value is not a non-empty array of valid app entries.
 *
 * @example Validating an apps array loaded from `--apps`
 * ```typescript
 * const apps = validateApps([{ name: 'clock', outputDir: './dist' }], '/p/apps.json')
 * ```
 */
export function validateApps(value: unknown, sourcePath: string): DevAppConfig[] {
  if (!isArray(value)) {
    throw createError(`${sourcePath}: dev config must have an "apps" array.`)
  }
  if (value.length === 0) {
    throw createError(`${sourcePath}: "apps" must list at least one app.`)
  }
  return value.map((app, index) => validateDevApp(app, index, sourcePath))
}

/**
 * Validates an unknown value as a {@link DevConfig}.
 *
 * @param value - The loaded config value.
 * @param sourcePath - The config path, used in error messages.
 * @returns The validated config.
 * @throws {Error} When the config or any app entry is malformed.
 *
 * @example Validating a loaded dev config
 * ```typescript
 * const config = validateDevConfig({ apps: [{ name: 'clock', outputDir: './dist' }] }, '/p/hf-dev.config.json')
 * ```
 */
export function validateDevConfig(value: unknown, sourcePath: string): DevConfig {
  if (!isRecord(value)) {
    throw createError(`${sourcePath}: dev config must be an object.`)
  }
  const apps = validateApps(value['apps'], sourcePath)
  const debug = value['debug']
  if (debug !== undefined && !isRecord(debug)) {
    throw createError(`${sourcePath}: "debug" must be an object.`)
  }
  return { apps, ...(debug !== undefined && { debug }) }
}

/**
 * Narrows an unknown value to a valid TCP port number (integer, 1–65535).
 *
 * @param value - The value to test.
 * @returns `true` when the value is a usable port.
 */
function isPort(value: unknown): value is number {
  return typeof value === 'number' && isInteger(value) && value >= 1 && value <= 65535
}

/**
 * Parses a `--port` flag string into a validated port number.
 *
 * @param raw - The flag value.
 * @returns The parsed port.
 * @throws {Error} When the value is not an integer in the valid range.
 */
function parsePortFlag(raw: string): number {
  const port = Number(raw)
  if (!isPort(port)) {
    throw createError(`--port must be an integer between 1 and 65535, got "${raw}".`)
  }
  return port
}

/**
 * Reads an optional boolean toggle, defaulting to `true` when absent.
 *
 * @param value - The candidate toggle value.
 * @param fallback - The value used when the toggle is `undefined`.
 * @returns The resolved boolean.
 */
function toggle(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * Resolves the effective `hf-dev.config.*` into concrete app servers and debug
 * settings, applying `config file < flags` precedence: `--apps` replaces the
 * apps array, `--port` sets the debug-UI port, and `--config` selects the file.
 *
 * @param options - The working directory, parsed flags, and injectable deps.
 * @returns The resolved apps, debug toggles, debug port, and source path.
 * @throws {Error} When no config is found or the config/apps are malformed.
 *
 * @example Resolving a discovered dev config
 * ```typescript
 * const resolved = await resolveDevConfig({ cwd: process.cwd(), flags })
 * ```
 */
export async function resolveDevConfig(options: ResolveDevConfigOptions): Promise<ResolvedDevConfig> {
  const { cwd, flags } = options
  const discover = options.discover ?? discoverConfigFile
  const loadConfig = options.loadConfig ?? loadModuleFile

  const sourcePath = flags.config ? toAbsolute(cwd, flags.config) : discover(cwd, DEV_CONFIG_BASENAME)
  if (sourcePath === null) {
    throw createError(`No ${DEV_CONFIG_BASENAME}.* found in ${cwd}. Create one or pass --config.`)
  }
  const config = validateDevConfig(await loadConfig(sourcePath), sourcePath)

  const appsPath = flags.apps ? toAbsolute(cwd, flags.apps) : sourcePath
  const apps = flags.apps ? validateApps(await loadConfig(appsPath), appsPath) : config.apps
  const appsBaseDir = dirname(appsPath)

  const resolvedApps = apps.map((app, index) => ({
    name: app.name,
    outputDir: toAbsolute(appsBaseDir, app.outputDir),
    port: app.port ?? APP_PORT_BASE + index,
  }))

  return {
    apps: resolvedApps,
    debug: {
      enabled: toggle(config.debug?.enabled, true),
      messageLog: toggle(config.debug?.messageLog, true),
      securityView: toggle(config.debug?.securityView, true),
    },
    debugPort: flags.port ? parsePortFlag(flags.port) : DEFAULT_DEBUG_PORT,
    sourcePath,
  }
}
