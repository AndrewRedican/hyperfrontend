import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Socket } from 'node:net'
import type { Step, StepResult } from './contract'
import type { ServiceEvent } from './events'
import type { ExchangeOptions } from './exchange'
import type { WriteLimits } from './response-writer'
import type { ServiceDeps } from './service'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { systemClock } from './clock'
import { createConnections } from './connections'
import { emitEvent, errorName } from './events'
import { createExchange } from './exchange'
import { httpError } from './http-error'
import { runPipeline, settle } from './pipeline'
import { writeResponse } from './response-writer'

/** The bounds of a service that one exchange reads: the body cap, the trusted hops and the write bound. */
export type ListenerOptions = ExchangeOptions & WriteLimits

/** The injectable boundaries a listener reads: the clock and the event sink. */
export type ListenerDeps = Pick<ServiceDeps, 'clock' | 'report'>

/** Everything a server needs wired to serve a pipeline: one function per event, and the shutdown of its connections. */
export interface ServiceListener {
  /**
   * Handles Node's `request` event: starts the exchange, runs the pipeline and writes its answer.
   *
   * @param req - Node's request.
   * @param res - Node's response.
   */
  request(req: IncomingMessage, res: ServerResponse): void
  /**
   * Handles Node's `checkContinue` event: the same as a request, whose first body read answers `100 Continue`.
   *
   * @param req - Node's request, which carries `Expect: 100-continue`.
   * @param res - Node's response.
   */
  checkContinue(req: IncomingMessage, res: ServerResponse): void
  /**
   * Handles Node's `connection` event: tracks the socket until it closes.
   *
   * @param socket - The socket of a connection the server just accepted.
   */
  connection(socket: Socket): void
  /**
   * Handles Node's `clientError` event: answers and reports a protocol error, drops a client that left, and closes the socket either way.
   *
   * @param error - The error as Node hands it over.
   * @param socket - The socket the error belongs to.
   */
  clientError(error: Error, socket: Socket): void
  /**
   * Handles an `error` event of the server itself after the bind: reports it as a `server-error` failure and does nothing else.
   *
   * @param error - What the server failed with; only its name reaches the event.
   */
  serverError(error: Error): void
  /**
   * Shuts the connections down: idle ones at once, busy ones when their last exchange ends, and whatever is left when the grace runs out.
   *
   * @param graceMs - How long exchanges in flight may run on, in milliseconds on the injected clock.
   * @returns A promise that resolves when every tracked socket has closed. It never rejects.
   */
  drain(graceMs: number): Promise<void>
}

/**
 * Stands in for the pipeline of a request whose target was refused, so that the refusal passes the same boundary and writer as any answer.
 *
 * @throws {HttpError} Always, the 400 of a malformed target.
 */
function refuseTarget(): never {
  throw httpError(400, 'malformed-target')
}

/**
 * Builds the listeners of a service: the flow of one exchange from Node's event to the written response, and the
 * registry of connections behind the shutdown. Nothing is written inside Node's event: the answer of the pipeline,
 * the refusal of a malformed target included, goes out at least one microtask later, when Node knows whether the
 * request was received completely.
 *
 * @param steps - The pipeline, outermost first. A request no step answers gets 404.
 * @param options - The body cap, the trusted hops and the write bound of the service.
 * @param deps - The clock, the system one when omitted, and the event sink, silence when omitted.
 * @returns The listeners, frozen, each a closure that can be handed to `server.on` unbound.
 *
 * @example Wiring a server by hand
 * ```typescript
 * const listener = createServiceListener(steps, { bodyBytes: 65536, trustedProxyHops: 0, writeIdleTimeoutMs: 30000 }, {})
 * const server = createServer(listener.request)
 * server.on('checkContinue', listener.checkContinue)
 * server.on('connection', listener.connection)
 * server.on('clientError', listener.clientError)
 * server.listen(8080, () => server.on('error', listener.serverError))
 * // later: stop accepting, then let requests in flight finish within ten seconds
 * server.close()
 * await listener.drain(10000)
 * ```
 */
export function createServiceListener(steps: readonly Step[], options: ListenerOptions, deps: ListenerDeps): ServiceListener {
  const clock = deps.clock ?? systemClock
  const emit = (event: ServiceEvent): void => emitEvent(deps.report, event)
  const connections = createConnections(clock, emit)

  const handle =
    (expectsContinue: boolean) =>
    (req: IncomingMessage, res: ServerResponse): void => {
      const exchange = createExchange(req, res, options, clock, emit, expectsContinue)
      connections.enter(exchange.socket, exchange)
      const { request, context } = exchange
      const run = request === null ? refuseTarget : (): StepResult => runPipeline(steps, request, context)
      // why: inside Node's event the request never counts as complete, so an answer written here would close a connection it has no reason to close
      void settle(run, context).then((response) =>
        writeResponse(exchange, response, options, clock, () => connections.closing(exchange.socket, exchange))
      )
    }

  return freeze({
    request: handle(false),
    checkContinue: handle(true),
    connection: connections.connection,
    clientError: connections.clientError,
    serverError: (error: Error): void =>
      emit(freeze({ type: 'failure', code: 'server-error', name: errorName(error), method: null, route: null, path: null })),
    drain: connections.drain,
  })
}
