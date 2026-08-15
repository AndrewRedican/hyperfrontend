import type { StaticServerHandle } from '../../server/static-serve'
import type { CliFlags } from '../args'
import { resolve } from 'node:path'
import { resolveServeConfig } from '../../server/serve-config'
import { startStaticServer } from '../../server/static-serve'
import { waitForShutdown } from '../../shared/shutdown'
import { EXIT_ERROR, EXIT_OK } from '../exit-codes'

/** Injectable boundaries for `runServe`, defaulted for production and overridden in tests. */
export interface ServeDeps {
  /** Resolves the static-server config and CLI flags into a concrete serving plan. */
  readonly resolveConfig?: typeof resolveServeConfig
  /** Starts the resolved static server. */
  readonly startServer?: typeof startStaticServer
  /** Holds the command open while the server runs; receives the running handle and resolves once serving should end. Defaults to waiting for `SIGINT`/`SIGTERM`, then closing the server. */
  readonly waitForClose?: (handle: StaticServerHandle) => Promise<void>
}

/** Inputs for a single `serve` invocation. */
export interface RunServeOptions extends ServeDeps {
  /** Parsed CLI flags. */
  readonly flags: CliFlags
  /** Working directory the config and root paths resolve against. */
  readonly cwd: string
  /** Sink for the running-server summary and the access log. */
  readonly stdout: NodeJS.WritableStream
  /** Sink for diagnostics. */
  readonly stderr: NodeJS.WritableStream
}

/**
 * Keeps the static server running until a termination signal arrives, then
 * closes it so the command can exit cleanly.
 *
 * @param handle - The running server to close once a signal is received.
 * @returns A promise that resolves after the server has closed.
 */
async function holdUntilShutdown(handle: StaticServerHandle): Promise<void> {
  await waitForShutdown()
  await handle.close()
}

/**
 * Resolves the `hf-serve.config.*` through the shared tiered loader and starts
 * the production static server. After printing the serving line the returned
 * promise stays pending while the server runs; it resolves with the success
 * code once a shutdown signal (`SIGINT`/`SIGTERM`, e.g. Ctrl-C or a platform
 * redeploy) arrives and the server has closed cleanly.
 *
 * @param options - Flags, working directory, output sinks, and injectable deps.
 * @returns The process exit code.
 *
 * @example Serving a built site from the current directory
 * ```typescript
 * const code = await runServe({ flags, cwd: process.cwd(), stdout: process.stdout, stderr: process.stderr })
 * ```
 */
export async function runServe(options: RunServeOptions): Promise<number> {
  const { flags, stdout, stderr } = options
  const cwd = flags.cwd ? resolve(options.cwd, flags.cwd) : options.cwd
  const resolveConfig = options.resolveConfig ?? resolveServeConfig
  const startServer = options.startServer ?? startStaticServer
  const waitForClose = options.waitForClose ?? holdUntilShutdown

  try {
    const config = await resolveConfig({ cwd, flags })
    const handle = await startServer(config, { log: (line) => stdout.write(`${line}\n`) })
    stdout.write(`  ${config.root} → ${handle.url}\n`)
    await waitForClose(handle)
    return EXIT_OK
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return EXIT_ERROR
  }
}
