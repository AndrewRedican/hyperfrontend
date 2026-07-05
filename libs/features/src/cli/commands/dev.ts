import type { DevServerHandle } from '../../server/dev-server'
import type { CliFlags } from '../args'
import { resolve } from 'node:path'
import { resolveDevConfig } from '../../server/config'
import { startDevServer } from '../../server/dev-server'
import { waitForShutdown } from '../../shared/shutdown'
import { EXIT_ERROR, EXIT_OK } from '../exit-codes'

/** Injectable boundaries for `runDev`, defaulted for production and overridden in tests. */
export interface DevDeps {
  /** Resolves the dev-server config and CLI flags into concrete app servers. */
  readonly resolveConfig?: typeof resolveDevConfig
  /** Starts the resolved dev server. */
  readonly startServer?: typeof startDevServer
  /** Holds the command open while the servers run; receives the running handle and resolves once serving should end. Defaults to waiting for `SIGINT`/`SIGTERM`, then closing every server. */
  readonly waitForClose?: (handle: DevServerHandle) => Promise<void>
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
 * Keeps the dev server running until a termination signal arrives, then closes
 * every server so the command can exit cleanly.
 *
 * @param handle - The running dev server to close once a signal is received.
 * @returns A promise that resolves after all servers have closed.
 */
async function holdUntilShutdown(handle: DevServerHandle): Promise<void> {
  await waitForShutdown()
  await handle.close()
}

/**
 * Resolves the `hf-dev.config.*` through the shared tiered loader and starts the
 * dev server: one static server per app plus the debug UI. After printing the
 * server URLs the returned promise stays pending while the servers run; it
 * resolves with the success code once a shutdown signal (`SIGINT`/`SIGTERM`,
 * e.g. Ctrl-C) arrives and every server has closed cleanly.
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
  const waitForClose = options.waitForClose ?? holdUntilShutdown

  try {
    const config = await resolveConfig({ cwd, flags })
    const handle = await startServer(config)
    handle.apps.forEach((app) => stdout.write(`  ${app.name} → ${app.url}\n`))
    if (handle.debugUrl !== undefined) {
      stdout.write(`Debug UI: ${handle.debugUrl}\n`)
    }
    await waitForClose(handle)
    return EXIT_OK
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return EXIT_ERROR
  }
}
