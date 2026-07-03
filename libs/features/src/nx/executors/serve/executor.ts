import type { DevServerHandle } from '../../../server'
import type { AsyncIteratorExecutor, ExecutorContext } from '../../model'
import { EXIT_OK, runDev } from '../../../cli'
import { waitForShutdown } from '../../../shared/shutdown'
import { resolveProjectCwd } from '../../shared/context'
import { headlessFlags } from '../../shared/flags'

/** Options for the `serve` executor; mirrors `schema.json`. */
interface ServeExecutorSchema {
  /** Path to the dev-server config object. */
  config?: string
  /** Path to the dev-server apps array. */
  apps?: string
  /** Port the dev server's debug UI listens on. */
  port?: string
}

/** Outcome of starting the dev server. */
interface ServeStartup {
  /** Whether the dev server started successfully. */
  ok: boolean
  /** The running server handle, when startup captured one. */
  handle?: DevServerHandle
}

/**
 * Start the dev server, capturing its handle via an injected `waitForClose`.
 *
 * `runDev` owns the server lifetime by default (it stays pending until a
 * shutdown signal, then closes). The executor must yield a startup result
 * while the servers keep running, so its injected wait resolves immediately
 * after capturing the handle and the executor drives shutdown itself.
 *
 * @param options - Schema-validated serve options.
 * @param context - The Nx executor context for the running target.
 * @returns The startup outcome and captured handle.
 */
async function startServe(options: ServeExecutorSchema, context: ExecutorContext): Promise<ServeStartup> {
  let handle: DevServerHandle | undefined
  const code = await runDev({
    flags: headlessFlags({ config: options.config, apps: options.apps, port: options.port }),
    cwd: resolveProjectCwd(context),
    stdout: process.stdout,
    stderr: process.stderr,
    waitForClose: async (running) => {
      handle = running
    },
  })
  return { ok: code === EXIT_OK, handle }
}

/**
 * Close a captured dev-server handle, if any.
 *
 * @param handle - The handle to close, or `undefined` when none was captured.
 * @returns A promise that resolves once the servers have closed.
 */
async function closeHandle(handle: DevServerHandle | undefined): Promise<void> {
  if (handle !== undefined) {
    await handle.close()
  }
}

/**
 * Serve a hyperfrontend feature dev server by delegating to the SDK's `hf dev`.
 *
 * Long-running async-iterator executor: it starts the dev server, yields the
 * startup result, stays alive until a shutdown signal, then closes the servers.
 *
 * @param options - Schema-validated serve options.
 * @param context - The Nx executor context for the running target.
 * @yields {ExecutorResult} The serve target's success state once the dev server is listening.
 * @returns An async iterator yielding the serve target's success state.
 */
const serveExecutor: AsyncIteratorExecutor<ServeExecutorSchema> = async function* (options, context) {
  const startup = await startServe(options, context)
  yield { success: startup.ok }
  if (startup.ok) {
    try {
      await waitForShutdown()
    } finally {
      await closeHandle(startup.handle)
    }
  }
}

export default serveExecutor
