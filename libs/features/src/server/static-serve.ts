import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { ResolvedServeConfig } from './serve-config'
import type { ServeStep, ServeStepContext, StaticResponse } from './serve-pipeline'
import type { ServeStepDeps } from './serve-steps'
import { createServer as createHttpServer } from 'node:http'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { closeServer, listen } from './listen'
import { plainResponse, runSteps } from './serve-pipeline'
import { buildServeSteps } from './serve-steps'
import { requestPath } from './static-handler'

/** Injectable boundaries for {@link startStaticServer}, defaulted for production. */
export interface StaticServeDeps extends ServeStepDeps {
  /** Creates an HTTP server from a request handler. */
  readonly createServer?: (handler: (req: IncomingMessage, res: ServerResponse) => void) => Server
  /** Sink for one access-log line per request. */
  readonly log?: (line: string) => void
  /** Custom steps prepended to the built-in pipeline; the first step sees every request first. */
  readonly steps?: readonly ServeStep[]
}

/** A running static server: its address and a teardown. */
export interface StaticServerHandle {
  /** The port the server is actually listening on. */
  readonly port: number
  /** An origin URL the site is reachable at: the bound interface, or `localhost` for a wildcard bind. */
  readonly url: string
  /** Stops the server and resolves once it has closed. */
  close(): Promise<void>
}

/**
 * Writes a pipeline response onto the Node response, suppressing the body for
 * `HEAD` so the advertised headers still describe the `GET` answer.
 *
 * @param method - The request method.
 * @param response - The pipeline's response value.
 * @param res - The HTTP response to write.
 */
function writeResponse(method: string, response: StaticResponse, res: ServerResponse): void {
  res.statusCode = response.status
  for (const name of keys(response.headers)) {
    res.setHeader(name, <string>response.headers[name])
  }
  if (method === 'HEAD' || response.body === null) {
    res.end()
    return
  }
  res.end(response.body)
}

/**
 * Builds the request listener that runs every request through the serve
 * pipeline: any custom steps first, then the built-ins (method guard,
 * compression, header rules, file serving). A step that throws answers 500
 * rather than crashing the server.
 *
 * This is the replacement seam: anything that can call this listener — Node's
 * `http.createServer`, a test harness, or another runtime adapter — can host
 * the pipeline unchanged.
 *
 * @param config - The resolved serving plan.
 * @param deps - Optional file-system, logging, and pipeline overrides.
 * @returns A request handler suitable for `http.createServer`.
 *
 * @example Hosting the pipeline on a hand-made server
 * ```typescript
 * const server = createServer(createServeListener(resolved))
 * ```
 */
export function createServeListener(
  config: ResolvedServeConfig,
  deps: StaticServeDeps = {}
): (req: IncomingMessage, res: ServerResponse) => void {
  const steps: readonly ServeStep[] = [...(deps.steps ?? []), ...buildServeSteps(config, deps)]
  const log = deps.log
  return (req, res) => {
    const method = req.method ?? 'GET'
    const url = req.url ?? '/'
    const context: ServeStepContext = { config }
    let response: StaticResponse
    try {
      response = runSteps(steps, { method, url, headers: req.headers }, context)
    } catch (error) {
      response = plainResponse(500, 'Internal Server Error')
      log?.(`error ${error instanceof Error ? error.message : String(error)}`)
    }
    if (config.log) {
      log?.(`${method} ${requestPath(url)} ${response.status}`)
    }
    try {
      writeResponse(method, response, res)
    } catch (error) {
      log?.(`error ${error instanceof Error ? error.message : String(error)}`)
      // why: A response Node refuses to write (bad header bytes, out-of-range status) must never escape the listener — one request would take the whole server down.
      try {
        res.statusCode = 500
        res.end('Internal Server Error')
      } catch {
        // why: The socket is already unusable; there is nothing left to answer on.
      }
    }
  }
}

/**
 * Starts the production static server on the resolved address and serves the
 * root until closed.
 *
 * @param config - The resolved serving plan.
 * @param deps - Optional server-creation, file-system, logging, and pipeline overrides.
 * @returns A handle exposing the bound address and a teardown.
 *
 * @example Serving a built site
 * ```typescript
 * const handle = await startStaticServer(resolved)
 * console.log(handle.url)
 * await handle.close()
 * ```
 */
export async function startStaticServer(config: ResolvedServeConfig, deps: StaticServeDeps = {}): Promise<StaticServerHandle> {
  const createServer = deps.createServer ?? createHttpServer
  const server = createServer(createServeListener(config, deps))
  const port = await listen(server, config.port, config.host)
  // why: A wildcard bind answers on loopback, so the printed origin is one a local browser can actually open; a specific interface is printed as itself.
  const displayHost = config.host === undefined || config.host === '0.0.0.0' || config.host === '::' ? 'localhost' : config.host
  return {
    port,
    url: `http://${displayHost}:${port}/`,
    close: () => closeServer(server),
  }
}
