import type { CliFlags } from '../cli/args'
import type { ServeConfig, ServeHeaderRule } from '../shared/serve-types'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { exists } from '@hyperfrontend/project-scope/core/fs'
import { discoverConfigFile, SERVE_CONFIG_BASENAME } from '../cli/config/discover'
import { loadModuleFile } from '../cli/config/load-module'

// note: Default listen port, adjacent to the demo family's 428x band without colliding with the dev server's 4280 debug UI.
const DEFAULT_SERVE_PORT = 4284

// note: The only artifact-carried config format; TS/JS configs need the loader's import machinery and belong beside the project instead.
const ARTIFACT_CONFIG_FILENAME = `${SERVE_CONFIG_BASENAME}.json`

// note: RFC 7230 token characters — the only bytes legal in a header field name.
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/

// note: Bytes Node's setHeader rejects at request time; catching them here turns a config typo into a load error instead of a per-request crash.
const HEADER_VALUE_FORBIDDEN = /[\r\n\0]/

/** A fully-resolved `hf-serve.config.*`: concrete root, listen address, and header rules. */
export interface ResolvedServeConfig {
  /** Absolute directory served as the site root. */
  readonly root: string
  /** Port the server listens on. */
  readonly port: number
  /** Interface the server binds; every interface when `undefined`. */
  readonly host?: string
  /** Ordered header rules, later rules overriding earlier ones per header. */
  readonly headers: readonly ServeHeaderRule[]
  /** Whether each request is access-logged. */
  readonly log: boolean
  /** Absolute path of the config file that was loaded, absent when serving with pure defaults. */
  readonly sourcePath?: string
}

/** Injectable boundaries for {@link resolveServeConfig}, defaulted for production. */
export interface ResolveServeConfigDeps {
  /** Loads a config file. */
  readonly loadConfig?: (absolutePath: string) => Promise<unknown>
  /** Discovers the static-server config file under a directory. */
  readonly discover?: (directory: string, baseName: string) => string | null
  /** Reports whether a path exists. */
  readonly exists?: (path: string) => boolean
}

/** Inputs for {@link resolveServeConfig}. */
export interface ResolveServeConfigOptions extends ResolveServeConfigDeps {
  /** Working directory the config and root paths resolve against. */
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
 * Validates one header rule, asserting optional `prefix`/`suffix` strings and a
 * string-valued `headers` record.
 *
 * @param value - The candidate header rule.
 * @param index - The rule's index, used to locate problems in the error message.
 * @param sourcePath - The file the rule came from, used in the error message.
 * @returns The validated header rule.
 * @throws {Error} When a field is mistyped.
 *
 * @example Validating a single header rule
 * ```typescript
 * const rule = validateHeaderRule({ suffix: '.html', headers: { 'Cache-Control': 'no-cache' } }, 0, '/p/hf-serve.config.json')
 * ```
 */
export function validateHeaderRule(value: unknown, index: number, sourcePath: string): ServeHeaderRule {
  if (!isRecord(value)) {
    throw createError(`${sourcePath}: headers[${index}] must be an object.`)
  }
  if (value['prefix'] !== undefined && typeof value['prefix'] !== 'string') {
    throw createError(`${sourcePath}: headers[${index}].prefix must be a string.`)
  }
  if (value['suffix'] !== undefined && typeof value['suffix'] !== 'string') {
    throw createError(`${sourcePath}: headers[${index}].suffix must be a string.`)
  }
  const headers = value['headers']
  if (!isRecord(headers)) {
    throw createError(`${sourcePath}: headers[${index}].headers must be an object.`)
  }
  for (const name of keys(headers)) {
    if (!HEADER_NAME_PATTERN.test(name)) {
      throw createError(`${sourcePath}: headers[${index}].headers["${name}"] is not a valid header name.`)
    }
    if (typeof headers[name] !== 'string') {
      throw createError(`${sourcePath}: headers[${index}].headers["${name}"] must be a string.`)
    }
    if (HEADER_VALUE_FORBIDDEN.test(<string>headers[name])) {
      throw createError(`${sourcePath}: headers[${index}].headers["${name}"] must not contain control characters.`)
    }
  }
  return <ServeHeaderRule>(<unknown>value)
}

/**
 * Validates an unknown value as a {@link ServeConfig}.
 *
 * @param value - The loaded config value.
 * @param sourcePath - The config path, used in error messages.
 * @returns The validated config.
 * @throws {Error} When the config or any header rule is malformed.
 *
 * @example Validating a loaded serve config
 * ```typescript
 * const config = validateServeConfig({ root: 'dist/site' }, '/p/hf-serve.config.json')
 * ```
 */
export function validateServeConfig(value: unknown, sourcePath: string): ServeConfig {
  if (!isRecord(value)) {
    throw createError(`${sourcePath}: serve config must be an object.`)
  }
  if (value['root'] !== undefined && (typeof value['root'] !== 'string' || value['root'].length === 0)) {
    throw createError(`${sourcePath}: "root" must be a non-empty string.`)
  }
  if (value['port'] !== undefined && !isPort(value['port'])) {
    throw createError(`${sourcePath}: "port" must be an integer between 1 and 65535.`)
  }
  if (value['host'] !== undefined && (typeof value['host'] !== 'string' || value['host'].length === 0)) {
    throw createError(`${sourcePath}: "host" must be a non-empty string.`)
  }
  if (value['log'] !== undefined && typeof value['log'] !== 'boolean') {
    throw createError(`${sourcePath}: "log" must be a boolean.`)
  }
  const headers = value['headers']
  if (headers !== undefined && !isArray(headers)) {
    throw createError(`${sourcePath}: "headers" must be an array.`)
  }
  if (isArray(headers)) {
    headers.forEach((rule, index) => validateHeaderRule(rule, index, sourcePath))
  }
  return <ServeConfig>(<unknown>value)
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
 * applying `defaults < config file < flags` precedence: `--root` sets the
 * served directory, `--port`/`--host` the listen address, and `--config`
 * selects the file. Unlike the dev server, serving is valid with no config at
 * all — the working directory is served with defaults.
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
    port: flags.port !== undefined ? parsePortFlag(flags.port) : (config.port ?? DEFAULT_SERVE_PORT),
    ...(host !== undefined && { host }),
    headers: config.headers ?? [],
    log: config.log ?? true,
    ...(sourcePath !== null && { sourcePath }),
  }
}
