import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import type { Socket } from 'node:net'
import type { ServiceClock } from './clock'
import type { BaseContext, RouteParams, ServiceRequest } from './contract'
import type { RequestEvent, RequestOutcome, ServiceEvent } from './events'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createTypeError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { isFinite } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { create, entries, freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { duration, emitEvent, errorName } from './events'
import { isFailureCode } from './http-error'
import { createRequestBody } from './request-body'
import { canonicalTarget, queryView } from './request-target'

/** The service options one exchange reads. */
export interface ExchangeOptions {
  /** The cap of the body's buffering readers when a call gives none, in bytes. */
  readonly bodyBytes: number
  /** How many forwarding hops are believed when the client's address is read. */
  readonly trustedProxyHops: number
}

/** One request and its response, from Node's `request` event to the first `close` of the response or of its socket. */
export interface Exchange {
  /** Node's request, which the writer reads `method` and `complete` from. */
  readonly req: IncomingMessage
  /** Node's response, which the writer writes to. */
  readonly res: ServerResponse
  /** The connection's socket, taken from the request when the exchange started; the response has none while it is queued behind an earlier one. */
  readonly socket: Socket
  /** The request steps receive, or `null` when the target was refused and no step may run. */
  readonly request: ServiceRequest | null
  /** The base context steps receive. */
  readonly context: BaseContext
  /** Whether the request arrived with `Expect: 100-continue`, so that its first body read answers `100 Continue`. */
  readonly expectsContinue: boolean
  /** Whether the exchange has ended. It turns `true` before the callbacks of `onEnd` run. */
  readonly ended: boolean
  /** How the exchange ended, or `null` while nothing has decided it. */
  readonly outcome: RequestOutcome | null
  /** The status that was noted, or 0 while no head was written. */
  readonly status: number
  /**
   * Decides how the exchange ended, once: the first cause wins and a later one changes nothing. Every cause but `sent` aborts the context's signal.
   *
   * @param outcome - What ended the exchange.
   * @returns `true` when this call decided the outcome, `false` when an earlier one had.
   */
  settleOutcome(outcome: RequestOutcome): boolean
  /**
   * Records the status of a head that was written for this exchange, for its request event.
   *
   * @param status - The status code on the wire.
   */
  noteStatus(status: number): void
  /**
   * Emits a failure event for a fault the kernel met in this exchange: the code, the error's name, and the method with the route or the path.
   * It emits nothing once an outcome is settled, since the first cause wins and what follows it is not reported; so a fault is
   * reported before the outcome it leads to is settled. What a step reports through the context is emitted whenever it is called.
   *
   * @param code - One of the kernel's failure codes.
   * @param error - What went wrong; only its name reaches the event.
   */
  failure(code: string, error: unknown): void
  /**
   * Registers a callback for the end of the exchange. Callbacks run once, in the order registered, after the outcome is
   * settled and before the request event is emitted. One registered after the end runs at once. A callback must not throw.
   *
   * @param callback - What to run when the exchange ends.
   * @returns A function that takes the callback back, for a wait that is over before the exchange is.
   */
  onEnd(callback: () => void): () => void
}

/** What a step may annotate. */
type Annotation = string | number | boolean

// note: An annotation name is a short lower-case word, so a line of the log can be split on spaces and equals signs.
const ANNOTATION_NAME = /^[a-z][a-z0-9_-]{0,31}$/

/**
 * Receives an error of the request or of the response and does nothing with it.
 *
 * @returns Nothing; the listener exists only so that the error has one.
 */
const ignoreError = (): undefined => undefined

/**
 * Copies Node's header object so that steps cannot pass state to each other through it.
 *
 * @param headers - The lower-cased headers of the request.
 * @returns A frozen copy without a prototype, the array of a repeated header copied and frozen too.
 */
function copyHeaders(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  const copy = create(null) as IncomingHttpHeaders
  for (const [name, value] of entries(headers)) {
    copy[name] = isArray(value) ? (freeze([...value]) as string[]) : value
  }
  return freeze(copy)
}

/**
 * Finds the caller's address as far as it can be trusted: the socket's peer, or the forwarded entry as many places
 * from the right as there are trusted hops. The leftmost entry, which the client wrote, is never preferred.
 *
 * @param req - Node's request.
 * @param hops - How many proxies in front are believed; 0 believes none.
 * @returns The address, or an empty string when the socket reports none.
 */
function clientAddress(req: IncomingMessage, hops: number): string {
  const forwarded = req.headers['x-forwarded-for']
  const listed = typeof forwarded === 'string' ? forwarded.split(',').map((entry) => entry.trim()) : []
  // how: with no trusted hop the index is one past the end, so nothing the client sent is ever read
  const entry = listed[listed.length - hops] ?? ''
  return entry.length >= 1 && entry.length <= 64 ? entry : (req.socket.remoteAddress ?? '')
}

/**
 * Refuses an annotation that could not be written as one field of an event.
 *
 * @param name - The field's name as the step gave it.
 * @param value - The field's value as the step gave it.
 * @throws {TypeError} With a fixed message, for a name that is not a short lower-case word or a value that is not a string, a finite number or a boolean.
 */
function checkAnnotation(name: unknown, value: unknown): void {
  if (typeof name !== 'string' || !ANNOTATION_NAME.test(name)) {
    throw createTypeError('annotate: the name must be a lower-case letter followed by up to 31 lower-case letters, digits, "_" or "-".')
  }
  if (typeof value !== 'string' && typeof value !== 'boolean' && !isFinite(value)) {
    throw createTypeError('annotate: the value must be a string, a finite number or a boolean.')
  }
}

/**
 * Copies what steps annotated into the object a request event carries.
 *
 * @param annotations - The fields in the order of each name's first write.
 * @returns A frozen object without a prototype, its keys in that order.
 */
function copyAnnotations(annotations: ReadonlyMap<string, Annotation>): Readonly<Record<string, Annotation>> {
  const copy = create(null) as Record<string, Annotation>
  for (const [name, value] of annotations) {
    copy[name] = value
  }
  return freeze(copy)
}

/**
 * Starts the exchange of one request: canonicalises the target, builds the frozen request and context steps receive,
 * gives the request and the response an error listener, and waits for the first `close` of the response or of its socket.
 * At that end, which is handled once, it removes both listeners, settles the outcome (`sent` when the response had finished,
 * else `client-closed`), runs the callbacks of `onEnd` and emits the one request event.
 *
 * @param req - Node's request, as the `request` or `checkContinue` event hands it over.
 * @param res - Node's response of the same event.
 * @param options - The body cap and the trusted hops of the service.
 * @param clock - The clock the duration is measured on.
 * @param emit - Where the exchange's events go. It is called through a guard, so a sink that throws or rejects is ignored.
 * @param expectsContinue - Whether the request arrived through `checkContinue`.
 * @returns The exchange, frozen.
 *
 * @example Starting an exchange and answering it behind the boundary
 * ```typescript
 * const exchange = createExchange(req, res, { bodyBytes: 65536, trustedProxyHops: 0 }, systemClock, deps.report ?? (() => undefined), false)
 * const run = (): StepResult => {
 *   if (exchange.request === null) throw httpError(400, 'malformed-target')
 *   return runPipeline(steps, exchange.request, exchange.context)
 * }
 * const response = await settle(run, exchange.context)
 * ```
 */
export function createExchange(
  req: IncomingMessage,
  res: ServerResponse,
  options: ExchangeOptions,
  clock: ServiceClock,
  emit: (event: ServiceEvent) => void,
  expectsContinue: boolean
): Exchange {
  const started = clock.now()
  const socket = req.socket
  const method = req.method as string
  const target = canonicalTarget(req.url as string)
  const controller = new AbortController()
  const annotations = createMap<string, Annotation>()
  const callbacks = createSet<() => void>()
  let route: string | null = null
  let outcome: RequestOutcome | null = null
  let status = 0
  let ended = false
  let emitted = false
  let request: ServiceRequest | null = null

  // how: the route name stands in for the path as soon as a route claimed the request, and a refused target has neither
  const place = (): Pick<RequestEvent, 'method' | 'route' | 'path'> => ({
    method,
    route,
    path: route === null && target !== null ? target.path : null,
  })

  const emitFailure = (code: string, error: unknown): void =>
    emitEvent(emit, freeze({ type: 'failure', code, name: errorName(error), ...place() }))

  const failure = (code: string, error: unknown): void => {
    // why: once something decided how the exchange ended, what the kernel meets afterwards is a consequence of that end, not a fault to log
    if (outcome === null) {
      emitFailure(code, error)
    }
  }

  const settleOutcome = (cause: RequestOutcome): boolean => {
    if (outcome !== null) {
      return false
    }
    outcome = cause
    if (cause !== 'sent') {
      controller.abort()
    }
    return true
  }

  const onEnd = (callback: () => void): (() => void) => {
    if (ended) {
      callback()
    } else {
      callbacks.add(callback)
    }
    return () => void callbacks.delete(callback)
  }

  const end = (): void => {
    // why: Node closes a response from its own listener on the socket, so the second close can arrive while the first is still being delivered
    if (ended) {
      return
    }
    // why: a kept-alive connection would otherwise gather one listener per request it carried
    res.removeListener('close', end)
    socket.removeListener('close', end)
    settleOutcome(res.writableFinished ? 'sent' : 'client-closed')
    ended = true
    callbacks.forEach((callback) => callback())
    callbacks.clear()
    emitted = true
    emitEvent(
      emit,
      freeze({
        type: 'request',
        ...place(),
        status,
        outcome: outcome as RequestOutcome,
        durationMs: duration(started, clock.now()),
        annotations: copyAnnotations(annotations),
      })
    )
  }

  const context: BaseContext = freeze({
    signal: controller.signal,
    client: freeze({ address: clientAddress(req, options.trustedProxyHops) }),
    annotate: (name: string, value: Annotation): void => {
      checkAnnotation(name, value)
      if (emitted) {
        return
      }
      if (name === 'route') {
        route = `${value}`
      } else {
        annotations.set(name, value)
      }
    },
    report: (code: string, error: unknown): void => {
      if (!isFailureCode(code)) {
        throw createTypeError('report: the code must be lower-case words joined by hyphens.')
      }
      emitFailure(code, error)
    },
  })

  const exchange: Exchange = freeze({
    req,
    res,
    socket,
    context,
    expectsContinue,
    settleOutcome,
    failure,
    onEnd,
    noteStatus: (written: number): void => {
      status = written
    },
    get request(): ServiceRequest | null {
      return request
    },
    get ended(): boolean {
      return ended
    },
    get outcome(): RequestOutcome | null {
      return outcome
    },
    get status(): number {
      return status
    },
  })

  if (target !== null) {
    request = freeze({
      method,
      url: req.url as string,
      headers: copyHeaders(req.headers),
      path: target.path,
      query: queryView(target.query),
      params: freeze(create(null) as RouteParams),
      body: createRequestBody(req, res, exchange, options.bodyBytes),
    })
  }

  // why: an error of either with no listener would be an uncaught exception, and between a handler's return and the writer nothing else listens
  req.on('error', ignoreError)
  res.on('error', ignoreError)
  res.on('close', end)
  socket.on('close', end)
  return exchange
}
