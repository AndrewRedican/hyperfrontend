import type { CliFlags } from '../args'
import { resolve } from 'node:path'
import { resolveDevConfig } from '../../server/config'
import { startDevServer } from '../../server/dev-server'
import { EXIT_ERROR, EXIT_OK } from '../exit-codes'

/** Injectable boundaries for `runDev`, defaulted for production and overridden in tests. */
export interface DevDeps {
  /** Resolves the dev-server config and CLI flags into concrete app servers. */
  readonly resolveConfig?: typeof resolveDevConfig
  /** Starts the resolved dev server. */
  readonly startServer?: typeof startDevServer
}

/** Inputs for a single `dev` invocation. */
export interface RunDevOptions extends DevDeps {
  /** Parsed CLI flags. */
  readonly flags: CliFlags
  /** Working directory the config path resolves against. */
  readonly cwd: string
  /** Sink for the running-server summary. */
  readonly stdout: NodeJS.WritableStream
  /** Sink for diagnostics. */
  readonly stderr: NodeJS.WritableStream
}

/**
 * Resolves the `hf-dev.config.*` through the shared tiered loader and starts the
 * dev server: one static server per app plus the debug UI. The returned promise
 * resolves once the servers are listening; the process stays alive serving them.
 *
 * @param options - Flags, working directory, output sinks, and injectable deps.
 * @returns The process exit code.
 *
 * @example Starting the dev server in the current directory
 * ```typescript
 * const code = await runDev({ flags, cwd: process.cwd(), stdout: process.stdout, stderr: process.stderr })
 * ```
 */
export async function runDev(options: RunDevOptions): Promise<number> {
  const { flags, stdout, stderr } = options
  const cwd = flags.cwd ? resolve(options.cwd, flags.cwd) : options.cwd
  const resolveConfig = options.resolveConfig ?? resolveDevConfig
  const startServer = options.startServer ?? startDevServer

  try {
    const config = await resolveConfig({ cwd, flags })
    const handle = await startServer(config)
    handle.apps.forEach((app) => stdout.write(`  ${app.name} → ${app.url}\n`))
    if (handle.debugUrl !== undefined) {
      stdout.write(`Debug UI: ${handle.debugUrl}\n`)
    }
    return EXIT_OK
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return EXIT_ERROR
  }
}
