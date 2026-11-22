import type { RequestListener, Server, ServerOptions } from 'node:http'
import type { ClockDeps } from './clock'
import type { Step } from './contract'
import type { ServiceEvent } from './events'
import { createServer as createHttpServer } from 'node:http'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { closeServer, listen } from '../listen'
import { createServiceListener } from './listener'
import { resolveServiceOptions } from './service-options'

/** What a service listens on, runs, and is bounded by. Every bound has a default; none is switched off by omission. */
export interface ServiceOptions {
  /** The pipeline, outermost first. A request no step answers gets 404. */
  readonly steps: readonly Step[]
  /** The port to bind; 0 lets the operating system choose. */
  readonly port: number
  /** The interface to bind; every interface when omitted. */
  readonly host?: string
  /** Default cap of `body.bytes()` and `body.json()`, in bytes; 65536 when omitted. */
  readonly bodyBytes?: number
  /** Time allowed for a complete header block, then 408; 10000 when omitted. Must be below `requestTimeoutMs`. */
  readonly headersTimeoutMs?: number
  /** Time allowed to receive one whole request, body included, then 408; 60000 when omitted. Server-wide, so a service with one long upload raises it. */
  readonly requestTimeoutMs?: number
  /** How long an idle kept-alive connection stays open; 5000 when omitted. */
  readonly keepAliveTimeoutMs?: number
  /** How long a response write may wait for the client to take bytes before the connection is cut; 30000 when omitted. It does not bound a stream body that stops producing. */
  readonly writeIdleTimeoutMs?: number
  /** How long `close()` waits for requests in flight before cutting them; 10000 when omitted. */
  readonly graceMs?: number
  /** Proxies in front whose `X-Forwarded-For` entries are believed; 0, which believes none, when omitted. */
  readonly trustedProxyHops?: number
}

/** Injectable boundaries of a service, defaulted for production. */
export interface ServiceDeps extends ClockDeps {
  /** Creates the HTTP server from Node's options and the request handler; `http.createServer` when omitted. A seam for specs: the service speaks plain HTTP, and a TLS server is not supported. */
  readonly createServer?: (options: ServerOptions, handler: RequestListener) => Server
  /** Receives every event. A sink that throws, or returns a promise that rejects, is ignored. No sink means silence. */
  readonly report?: (event: ServiceEvent) => void
}

/** A running service. Structurally a `StaticServerHandle`. */
export interface ServiceHandle {
  /** The port actually bound. */
  readonly port: number
  /**
   * The URL of the service's root, which ends in a slash, such as `http://localhost:8080/`: the bound interface, or `localhost` for a wildcard bind.
   * A path is resolved against it, as in `new URL('/healthz', handle.url)`, and never appended to it: `${handle.url}/healthz` asks for `//healthz`, which a service refuses with 400.
   */
  readonly url: string
  /** Stops accepting, lets requests in flight finish within the grace, then cuts what is left. Idempotent; never rejects. */
  close(): Promise<void>
}

/**
 * Names the host of the URL a service answers on.
 *
 * @param host - The interface the service was bound to, or `undefined` for every interface.
 * @returns A loopback name for a wildcard bind, an address that holds a colon in brackets, and any other host as it is.
 */
function urlHost(host: string | undefined): string {
  // why: an IPv4 wildcard bind does not answer on the IPv6 loopback, which is where `localhost` resolves first on many hosts
  if (host === '0.0.0.0') {
    return '127.0.0.1'
  }
  // why: these two binds are dual-stack, so the URL given is one a local client can open under either family
  if (host === undefined || host === '::') {
    return 'localhost'
  }
  return host.includes(':') ? `[${host}]` : host
}

/**
 * Binds and serves the steps. Rejects once, before binding, with an error naming every invalid option, and with the bind error when the port cannot be taken.
 *
 * @param options - The pipeline, the address and the bounds of the service.
 * @param deps - The server factory, the clock and the event sink; Node's own server, the system clock and silence when omitted.
 * @returns A promise for the running service: its port, its URL and its shutdown.
 *
 * @example Serving one step and shutting down on a signal
 * ```typescript
 * import { formatEvent, jsonResponse, startService, waitForShutdown } from '@hyperfrontend/server'
 *
 * const handle = await startService(
 *   { port: 8080, steps: [() => jsonResponse(200, { message: 'hello' })] },
 *   { report: (event) => process.stdout.write(`${formatEvent(event)}\n`) }
 * )
 * await waitForShutdown()
 * await handle.close() // requests in flight get ten seconds, then they are cut
 * ```
 *
 * @example Every invalid option arrives in one rejection, before anything is bound
 * ```typescript
 * import { startService } from '@hyperfrontend/server'
 *
 * await startService({ port: 70000, steps: [], graceMs: -1 })
 * // rejects: Invalid service options:
 * //   - "port" must be an integer between 0 and 65535.
 * //   - "graceMs" must be a non-negative integer.
 * ```
 */
export async function startService(options: ServiceOptions, deps?: ServiceDeps): Promise<ServiceHandle> {
  const resolved = resolveServiceOptions(options)
  const boundaries: ServiceDeps = deps ?? {}
  const listener = createServiceListener(resolved.steps, resolved, boundaries)
  const server = (boundaries.createServer ?? createHttpServer)(
    {
      headersTimeout: resolved.headersTimeoutMs,
      requestTimeout: resolved.requestTimeoutMs,
      keepAliveTimeout: resolved.keepAliveTimeoutMs,
      // why: Node checks its two timeouts on an interval, and a header time shorter than the interval would be noticed late
      connectionsCheckingInterval: min(5000, resolved.headersTimeoutMs),
    },
    listener.request
  )
  server.on('checkContinue', listener.checkContinue)
  server.on('connection', listener.connection)
  server.on('clientError', listener.clientError)
  const port = await listen(server, resolved.port, resolved.host)
  // why: the bind released its own error listener, and an accept error at run time with no listener would be an uncaught exception
  server.on('error', listener.serverError)
  let closing: Promise<void> | null = null
  return freeze({
    port,
    url: `http://${urlHost(resolved.host)}:${port}/`,
    close: (): Promise<void> => {
      if (closing === null) {
        // how: the server stops accepting first, so a connection that arrives during the drain is refused instead of tracked
        const closed = closeServer(server)
        closing = listener.drain(resolved.graceMs).then(() => closed)
      }
      return closing
    },
  })
}
