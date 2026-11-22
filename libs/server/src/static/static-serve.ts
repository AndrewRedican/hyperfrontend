import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { ResolvedServeConfig } from '../policy/serve-config'
import type { ServeStep, ServeStepContext, StaticResponse } from './serve-pipeline'
import type { ServeStepDeps } from './serve-steps'
import { createServer as createHttpServer } from 'node:http'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { closeServer, listen } from '../listen'
import { runSteps } from './serve-pipeline'
import { buildServeSteps, failureResponse } from './serve-steps'
import { requestPath } from './static-handler'

/** Injectable boundaries for {@link startStaticServer}, defaulted for production. */
export interface StaticServeDeps extends ServeStepDeps {
  /** Creates an HTTP server from a request handler. */
  readonly createServer?: (handler: (req: IncomingMessage, res: ServerResponse) => void) => Server
  /** Sink for one access-log line per request, written only when the config's `log` is `true`, and for one line per failure. Without a sink nothing is written, whatever the config says. */
  readonly log?: (line: string) => void
  /** Custom steps prepended to the built-in pipeline; the first step sees every request first and every response last. What a custom step answers by itself carries no header rule, since the built-in steps apply them. */
  readonly steps?: readonly ServeStep[]
}

/** A running static server: its address and a teardown. */
export interface StaticServerHandle {
  /** The port the server is actually listening on. */
  readonly port: number
  /** The URL of the site's root, which ends in a slash, such as `http://localhost:8080/`: the bound interface, or `localhost` for a wildcard bind. A path is resolved against it, as in `new URL('/app.js', handle.url)`. */
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
    res.setHeader(name, response.headers[name] as string)
  }
  if (method === 'HEAD' || response.body === null) {
    res.end()
    return
  }
  res.end(response.body)
}

/**
 * Removes what a refused response left on the Node response: every header it
 * had set, and the reason phrase Node took from its status when the refusal
 * came while the head was being written.
 *
 * @param res - The HTTP response a write was refused on.
 */
function clearRefused(res: ServerResponse): void {
  res.getHeaderNames().forEach((name) => res.removeHeader(name))
  // why: Node keeps a phrase that is already set and names the status line from the status code only when there is none.
  res.statusMessage = ''
}

/**
 * Answers 500 on a response Node refused to write. Whatever the refused
 * response had already set is removed first, so the failure never goes out
 * under the length, the entity tag or the reason phrase of a file. The
 * failure carries the plan's header rules; when those are what Node refuses,
 * it is sent again with no header at all.
 *
 * @param method - The request method.
 * @param failure - The failure answer carrying the plan's header rules.
 * @param res - The HTTP response to write.
 */
function writeFailure(method: string, failure: StaticResponse, res: ServerResponse): void {
  try {
    clearRefused(res)
    writeResponse(method, failure, res)
  } catch {
    try {
      clearRefused(res)
      res.statusCode = 500
      res.end('Internal Server Error')
    } catch {
      // why: The socket is already unusable; there is nothing left to answer on.
    }
  }
}

/**
 * Builds the request listener that runs every request through the serve
 * pipeline: any custom steps first, then the built-ins (method guard,
 * compression, header rules, file serving). A step that throws answers 500
 * rather than crashing the server, and that 500 carries the header rules that
 * match the request path, with `Cache-Control: no-store`.
 *
 * This is the replacement seam: anything that can call this listener (Node's
 * `http.createServer`, a test harness, or another runtime adapter) can host
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
      response = failureResponse(config, url)
      log?.(`error ${error instanceof Error ? error.message : String(error)}`)
    }
    if (config.log) {
      log?.(`${method} ${requestPath(url)} ${response.status}`)
    }
    try {
      writeResponse(method, response, res)
    } catch (error) {
      log?.(`error ${error instanceof Error ? error.message : String(error)}`)
      // why: A response Node refuses to write (bad header bytes, out-of-range status) must never escape the listener, or one request would take the whole server down.
      writeFailure(method, failureResponse(config, url), res)
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
