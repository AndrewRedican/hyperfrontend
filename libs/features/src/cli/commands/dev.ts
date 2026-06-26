import type { CliFlags } from '../args'
import { isAbsolute, resolve } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { DEV_CONFIG_BASENAME, discoverConfigFile } from '../config/discover'
import { loadModuleFile } from '../config/load-module'
import { EXIT_ERROR } from '../exit-codes'

/** Injectable boundaries for `runDev`, defaulted for production and overridden in tests. */
export interface DevDeps {
  /** Loads the resolved dev-server config file. */
  readonly loadConfig?: (absolutePath: string) => Promise<unknown>
  /** Discovers the dev-server config file under a directory. */
  readonly discover?: (directory: string, baseName: string) => string | null
}

/** Inputs for a single `dev` invocation. */
export interface RunDevOptions extends DevDeps {
  /** Parsed CLI flags. */
  readonly flags: CliFlags
  /** Working directory the config path resolves against. */
  readonly cwd: string
  /** Sink for resolution output. */
  readonly stdout: NodeJS.WritableStream
  /** Sink for diagnostics and the pending notice. */
  readonly stderr: NodeJS.WritableStream
}

/**
 * Counts the apps in a resolved dev config, asserting the minimal shape.
 *
 * @param value - The loaded config value.
 * @param sourcePath - The config path, used in the error message.
 * @returns The number of configured apps.
 */
function countApps(value: unknown, sourcePath: string): number {
  if (typeof value !== 'object' || value === null || !isArray((<Record<string, unknown>>value)['apps'])) {
    throw createError(`${sourcePath}: dev config must have an "apps" array.`)
  }
  return (<unknown[]>(<Record<string, unknown>>value)['apps']).length
}

/**
 * Resolves the `hf-dev.config.*` through the shared tiered loader and reports
 * that the dev server is not yet available.
 *
 * @param options - Flags, working directory, output sinks, and injectable deps.
 * @returns The process exit code.
 *
 * @example Resolving a dev config in the current directory
 * ```typescript
 * const code = await runDev({ flags, cwd: process.cwd(), stdout: process.stdout, stderr: process.stderr })
 * ```
 */
export async function runDev(options: RunDevOptions): Promise<number> {
  const { flags, stdout, stderr } = options
  const cwd = flags.cwd ? resolve(options.cwd, flags.cwd) : options.cwd
  const discover = options.discover ?? discoverConfigFile
  const loadConfig = options.loadConfig ?? loadModuleFile

  try {
    const sourcePath = flags.config ? toAbsolute(cwd, flags.config) : discover(cwd, DEV_CONFIG_BASENAME)
    if (sourcePath === null) {
      stderr.write(`No ${DEV_CONFIG_BASENAME}.* found in ${cwd}. Create one or pass --config.\n`)
      return EXIT_ERROR
    }
    const appCount = countApps(await loadConfig(sourcePath), sourcePath)
    stdout.write(`Resolved dev config: ${appCount} app(s) from ${sourcePath}.\n`)
    stderr.write('The dev server is not yet available.\n')
    return EXIT_ERROR
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return EXIT_ERROR
  }
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
