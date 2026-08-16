import type { BuildConfig, BuildResult } from '../models'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { join, readJsonFile } from '@hyperfrontend/project-scope/core'
import { build } from '../build'

/** Exit code emitted when the build completes successfully. */
export const HF_BUILD_EXIT_OK = 0

/** Exit code emitted when argv parsing, config loading, or the build itself fails. */
export const HF_BUILD_EXIT_ERROR = 1

/** Default config file basename resolved against `cwd` when `--config` is omitted. */
export const HF_BUILD_DEFAULT_CONFIG_NAME = 'builder.config.json'

const HELP_TEXT = [
  'Usage: hf-build [options]',
  '',
  'Options:',
  '  --config <path>   Path to a JSON config file (default: ./builder.config.json)',
  '  --cwd <path>      Working directory used when resolving relative paths',
  '  --verbose         Force config.verbose = true',
  '  -h, --help        Print this help and exit',
  '',
].join('\n')

/** Parsed argv subset consumed by the `hf-build` bin. */
export interface HfBuildArgs {
  /** Explicit override for the config file path (`--config`). */
  readonly configPath?: string
  /** Working directory override (`--cwd`). */
  readonly cwdOverride?: string
  /** Force `config.verbose = true` (`--verbose`). */
  readonly verbose: boolean
  /** User asked for help (`--help` / `-h`). */
  readonly help: boolean
}

/** Injectable dependencies for `runHfBuild`: defaulted for production, overridden in tests. */
export interface RunHfBuildDeps {
  /** Reads and parses the JSON config file. */
  readonly readConfig?: (path: string) => BuildConfig
  /** Runs the build pipeline. */
  readonly runBuild?: (config: BuildConfig) => Promise<BuildResult>
}

/** Inputs for a single `hf-build` invocation. */
export interface RunHfBuildOptions extends RunHfBuildDeps {
  /** Raw argv tail (excluding node + script), usually `process.argv.slice(2)`. */
  readonly argv: readonly string[]
  /** Default cwd used when argv does not provide `--cwd`. */
  readonly cwd: string
  /** Sink for diagnostic output (errors, parse failures). */
  readonly stderr: NodeJS.WritableStream
  /** Sink for the `--help` text. Falls back to `stderr` when omitted. */
  readonly stdout?: NodeJS.WritableStream
}

const requireValue = (token: string, value: string | undefined): string => {
  if (value === undefined) throw createError(`${token} requires a path`)
  return value
}

/**
 * Parses the argv understood by `hf-build`. Unknown flags throw so typos surface
 * at the boundary instead of being silently ignored. No positional arguments are
 * accepted: supplying one throws.
 *
 * @param argv - Argument list following the bin name (e.g. `process.argv.slice(2)`).
 * @returns Parsed arguments, with `verbose` and `help` defaulted to `false`.
 *
 * @example Parsing a `--config` override
 * ```typescript
 * parseHfBuildArgs(['--config', './builder.json'])
 * // => { configPath: './builder.json', verbose: false, help: false }
 * ```
 */
export function parseHfBuildArgs(argv: readonly string[]): HfBuildArgs {
  let configPath: string | undefined
  let cwdOverride: string | undefined
  let verbose = false
  let help = false

  for (let i = 0; i < argv.length; i++) {
    const token = <string>argv[i]
    if (token === '--config') {
      configPath = requireValue(token, argv[i + 1])
      i++
      continue
    }
    if (token === '--cwd') {
      cwdOverride = requireValue(token, argv[i + 1])
      i++
      continue
    }
    if (token === '--verbose') {
      verbose = true
      continue
    }
    if (token === '--help' || token === '-h') {
      help = true
      continue
    }
    throw createError(`Unknown argument: ${token}`)
  }

  return {
    ...(configPath !== undefined && { configPath }),
    ...(cwdOverride !== undefined && { cwdOverride }),
    verbose,
    help,
  }
}

const defaultReadConfig = (path: string): BuildConfig => readJsonFile<BuildConfig>(path)

/**
 * End-to-end `hf-build` entry: parse argv → resolve config path → load JSON config
 * → call {@link build} → translate the outcome into an exit code. All dependencies
 * are injectable so tests can substitute deterministic stand-ins without touching
 * the filesystem or running an actual build.
 *
 * Resolution order for the config file:
 * 1. `--config <path>` if provided
 * 2. `<cwd>/builder.config.json`
 *
 * `--cwd` overrides `options.cwd` for both config resolution and any relative
 * paths the consumer subsequently interprets against the resolved cwd.
 *
 * @param options - argv, cwd, stderr, optional stdout, and optional dependency overrides.
 * @returns Exit code: `0` on success, `1` on any failure (parse error, missing config, build throw).
 *
 * @example Running with the production defaults
 * ```typescript
 * const code = await runHfBuild({
 *   argv: process.argv.slice(2),
 *   cwd: process.cwd(),
 *   stderr: process.stderr,
 *   stdout: process.stdout,
 * })
 * process.exit(code)
 * ```
 */
export async function runHfBuild(options: RunHfBuildOptions): Promise<number> {
  const { stderr } = options
  const stdout = options.stdout ?? stderr
  const read = options.readConfig ?? defaultReadConfig
  const run = options.runBuild ?? build

  let args: HfBuildArgs
  try {
    args = parseHfBuildArgs(options.argv)
  } catch (error) {
    stderr.write(`${(<Error>error).message}\n`)
    return HF_BUILD_EXIT_ERROR
  }

  if (args.help) {
    stdout.write(HELP_TEXT)
    return HF_BUILD_EXIT_OK
  }

  const resolvedCwd = args.cwdOverride ?? options.cwd
  const configPath = args.configPath ?? join(resolvedCwd, HF_BUILD_DEFAULT_CONFIG_NAME)

  let config: BuildConfig
  try {
    config = read(configPath)
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return HF_BUILD_EXIT_ERROR
  }

  const merged: BuildConfig = args.verbose ? { ...config, verbose: true } : config

  try {
    await run(merged)
    return HF_BUILD_EXIT_OK
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return HF_BUILD_EXIT_ERROR
  }
}

export default runHfBuild
