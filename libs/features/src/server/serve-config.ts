import type { ResolvedServeConfig, ServeConfig } from '@hyperfrontend/server/policy'
import type { CliFlags } from '../cli/args'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { exists } from '@hyperfrontend/project-scope/core/fs'
import { expandHeaderPolicy, validateServeConfig } from '@hyperfrontend/server/policy'
import { discoverConfigFile, SERVE_CONFIG_BASENAME } from '../cli/config/discover'
import { loadModuleFile } from '../cli/config/load-module'

// note: Default listen port, adjacent to the demo family's 428x band without colliding with the dev server's 4280 debug UI.
const DEFAULT_SERVE_PORT = 4284

// note: The only artifact-carried config format; TS/JS configs need the loader's import machinery and belong beside the project instead.
const ARTIFACT_CONFIG_FILENAME = `${SERVE_CONFIG_BASENAME}.json`

/** Injectable boundaries for {@link resolveServeConfig}, defaulted for production. */
export interface ResolveServeConfigDeps {
  /** Loads a config file. */
  readonly loadConfig?: (absolutePath: string) => Promise<unknown>
  /** Discovers the static-server config file under a directory. */
  readonly discover?: (directory: string, baseName: string) => string | null
  /** Reports whether a path exists. */
  readonly exists?: (path: string) => boolean
  /** Environment variables consulted for the `PORT` fallback. */
  readonly env?: Record<string, string | undefined>
}

/** Inputs for {@link resolveServeConfig}. */
export interface ResolveServeConfigOptions extends ResolveServeConfigDeps {
  /** Working directory the config and root paths resolve against. */
  readonly cwd: string
  /** Parsed CLI flags, applied with the highest precedence. */
  readonly flags: CliFlags
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
 * Parses a port string into a validated port number.
 *
 * @param raw - The string value.
 * @param source - Where the value came from, named in the error message.
 * @returns The parsed port.
 * @throws {Error} When the value is not an integer in the valid range.
 */
function parsePort(raw: string, source: string): number {
  const port = Number(raw)
  if (!isPort(port)) {
    throw createError(`${source} must be an integer between 1 and 65535, got "${raw}".`)
  }
  return port
}

/**
 * Reads the platform-assigned `PORT` environment variable, when one is set.
 *
 * @param env - The environment variables to consult.
 * @returns The validated port, or `undefined` when unset.
 * @throws {Error} When `PORT` is set to something that is not a port.
 */
function envPort(env: Record<string, string | undefined>): number | undefined {
  const raw = env['PORT']
  // why: An empty PORT reads as unset — platforms inject a real value or nothing, and `PORT= hf serve` should not be an error.
  if (raw === undefined || raw === '') {
    return undefined
  }
  return parsePort(raw, 'PORT')
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
 * Selects the config file to load: `--config` first, then the served root's
 * own artifact-carried `hf-serve.config.json` when `--root` names one, then
 * discovery in the working directory.
 *
 * @param cwd - Absolute working directory.
 * @param flags - Parsed CLI flags.
 * @param discover - Config discovery function.
 * @param fileExists - Existence probe for the artifact-carried config.
 * @returns The absolute config path, or `null` to serve with pure defaults.
 */
function selectConfigPath(
  cwd: string,
  flags: CliFlags,
  discover: (directory: string, baseName: string) => string | null,
  fileExists: (path: string) => boolean
): string | null {
  if (flags.config !== undefined) {
    return toAbsolute(cwd, flags.config)
  }
  if (flags.root !== undefined) {
    const carried = join(toAbsolute(cwd, flags.root), ARTIFACT_CONFIG_FILENAME)
    // why: A config shipped inside the served artifact wins over one beside the invocation, so the deploy policy travels with the build output.
    if (fileExists(carried)) {
      return carried
    }
  }
  return discover(cwd, SERVE_CONFIG_BASENAME)
}

/**
 * Resolves the effective `hf-serve.config.*` into a concrete serving plan,
 * applying `defaults < config file < PORT environment variable < flags`
 * precedence: `--root` sets the served directory, `--port`/`--host` the listen
 * address, and `--config` selects the file. A platform-assigned `PORT` beats a
 * port baked into the served artifact's config, and an explicit `--port` still
 * beats both, so `hf serve --root <dir>` works without a port flag wherever
 * the platform injects one. Unlike the dev server, serving is valid with no config at
 * all: the working directory is served with defaults.
 *
 * The config's `embedders`, `permissionsPolicy` and `isolation` fields each
 * become one header rule for every path, placed in that order ahead of the
 * authored `headers` rules.
 *
 * @param options - The working directory, parsed flags, and injectable deps.
 * @returns The resolved root, listen address, header rules, and source path.
 * @throws {Error} When the selected config is malformed or the root does not exist.
 *
 * @example Resolving a static-serve config
 * ```typescript
 * const resolved = await resolveServeConfig({ cwd: process.cwd(), flags })
 * ```
 */
export async function resolveServeConfig(options: ResolveServeConfigOptions): Promise<ResolvedServeConfig> {
  const { cwd, flags } = options
  const discover = options.discover ?? discoverConfigFile
  const loadConfig = options.loadConfig ?? loadModuleFile
  const fileExists = options.exists ?? exists
  const env = options.env ?? process.env

  const sourcePath = selectConfigPath(cwd, flags, discover, fileExists)
  const config: ServeConfig = sourcePath === null ? {} : validateServeConfig(await loadConfig(sourcePath), sourcePath)
  const configBase = sourcePath === null ? cwd : dirname(sourcePath)

  const rootFlag = flags.root !== undefined ? toAbsolute(cwd, flags.root) : undefined
  const rootConfig = config.root !== undefined ? toAbsolute(configBase, config.root) : undefined
  const root = rootFlag ?? rootConfig ?? cwd
  if (!fileExists(root)) {
    throw createError(`Serve root does not exist: ${root}`)
  }

  const host = flags.host ?? config.host
  return {
    root,
    port: flags.port !== undefined ? parsePort(flags.port, '--port') : (envPort(env) ?? config.port ?? DEFAULT_SERVE_PORT),
    ...(host !== undefined && { host }),
    // why: The declared fields expand ahead of the authored rules, so a hand-written rule still overrides any header they set.
    headers: expandHeaderPolicy(config),
    log: config.log ?? true,
    ...(sourcePath !== null && { sourcePath }),
  }
}
