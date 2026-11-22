import type { Readable } from 'node:stream'
import type { StaticRequest } from '../static/serve-pipeline'

/** A context extension that adds nothing; the default of every `Needs` and `Adds`. */
export type NoContext = Readonly<Record<never, never>>

/** Path parameters as a step reads them: any name, loosely typed. A handler gets them typed from its route pattern instead. */
export type RouteParams = Readonly<Record<string, string>>

/** Read-only view of the query string. Names compare exactly; values are decoded. */
export interface QueryView {
  /** The first value under the name, or `null` when the name is absent. */
  get(name: string): string | null
  /** Every value under the name, in the order sent. */
  getAll(name: string): readonly string[]
  /** Whether the name occurs at all. */
  has(name: string): boolean
}

/**
 * The request body: nothing is read, and no `100 Continue` is sent, until a method is called.
 * Every reader either returns its value or throws an `HttpError` (413, 415, 400) the listener turns into the response.
 */
export interface RequestBody {
  /** The declared `Content-Length`, or `null` for a chunked or absent body. */
  readonly length: number | null
  /** Buffers the whole body, as sent. Memoised, so a signature check and a parse read the same bytes. The limit defaults to the service's `bodyBytes`. */
  bytes(limitBytes?: number): Promise<Buffer>
  /** `bytes()` decoded as strict UTF-8 and parsed as JSON. Requires the media type `application/json`. */
  json(limitBytes?: number): Promise<unknown>
  /**
   * The raw bytes as they arrive, with backpressure. Single use and exclusive with `bytes()`. The limit is required; `Infinity` is the only uncapped spelling.
   * Past the limit, or when the client leaves, the stream is destroyed with an `HttpError`. The kernel listens for that error itself, so an unread stream never raises an uncaught exception; read it with `pipeline` or `for await`, which receive the failure.
   * Do not read it with `pipe()`, which neither ends nor destroys its destination when the stream is destroyed: a file or a child's input stays open.
   */
  stream(limitBytes: number): Readable
}

/** One request as steps and handlers see it. Frozen, its headers included. Structurally a `StaticRequest`, so the static pipeline accepts it. */
export interface ServiceRequest<Params extends object = RouteParams> extends StaticRequest {
  /** The canonical decoded path: every segment decoded once, never a dot segment, an empty interior segment or an encoded separator. */
  readonly path: string
  /** The query string, parsed. */
  readonly query: QueryView
  /** Decoded path parameters of the matched route; empty before a router. An object without a prototype, so a name nobody declared reads `undefined`. */
  readonly params: Params
  /** The request body, unread. */
  readonly body: RequestBody
}

/**
 * What a step returns. Every `StaticResponse` is one.
 *
 * @example Streaming a child process's output and ending the child with the stream
 * ```typescript
 * import { spawn } from 'node:child_process'
 * import { PassThrough } from 'node:stream'
 * import { route } from '@hyperfrontend/server'
 *
 * export const archive = route('GET', '/archive', (request) => {
 *   const headers = { 'Content-Type': 'application/x-tar' }
 *   // a HEAD request reaches the GET route, and its body would be thrown away: spawn nothing for it
 *   if (request.method === 'HEAD') return { status: 200, headers, body: null }
 *   const child = spawn('tar', ['-c', 'data'], { stdio: ['ignore', 'pipe', 'ignore'] })
 *   const body = new PassThrough()
 *   child.stdout.pipe(body, { end: false })
 *   child.once('error', (error) => body.destroy(error))
 *   child.once('close', (code) => (code === 0 ? body.end() : body.destroy(new Error('the child failed'))))
 *   body.once('close', () => child.kill())
 *   return { status: 200, headers, body }
 * })
 * // a child that fails before its first byte is a 500 and not a complete, empty 200, and whatever ends the stream ends the child
 * // awaiting the child's first byte in the handler proves nothing: a stream that was read from is refused as a body
 * ```
 */
export interface ServiceResponse {
  /** The status code, 200 to 599. */
  readonly status: number
  /** Headers by exact name, one string each. */
  readonly headers: Readonly<Record<string, string>>
  /** Complete `Set-Cookie` values, one per cookie. */
  readonly cookies?: readonly string[]
  /**
   * Whole bytes, a stream of bytes, or nothing. A stream must be unread when it is returned.
   * The kernel calls `destroy()` on a stream whenever the exchange ends without the stream having been written to its end. That releases the stream, not what feeds it:
   * a handler that returns a child process's output ends the child on the stream's `close` event, since a `HEAD` request, a 204 and a 304 destroy the stream without aborting `signal`.
   * Nothing bounds a source that stops producing, since a route's deadline ends when the handler returns and the write timeout watches the client: a handler that streams keeps an idle timer on its source and destroys the stream when it fires.
   */
  readonly body: Buffer | Readable | null
}

/** The caller as far as it can be trusted. */
export interface ClientInfo {
  /** The socket peer's address, or the entry `trustedProxyHops` from the right of `X-Forwarded-For` when hops are declared. Empty when the socket reports none. */
  readonly address: string
}

/** Per-request state every step and handler receives. Frozen. */
export interface BaseContext {
  /** Aborts when the exchange ends without a complete response: the client goes away, the request times out, a response write stalls or fails, or the shutdown grace runs out. Inside a route with a deadline it also aborts when the deadline passes. Never aborts on a normal completion, a bodiless one (`HEAD`, 204, 304) included. */
  readonly signal: AbortSignal
  /** The caller. */
  readonly client: ClientInfo
  /** Adds one field to this request's event; a later value replaces an earlier one. Write-only, so it is not a channel between steps. Ignored once the request's event has been emitted. */
  annotate(name: string, value: string | number | boolean): void
  /** Reports a fault to the service's event sink without failing the request: a failure event with this code and the thrown error's name, never its message. Write-only. */
  report(code: string, error: unknown): void
}

/** The context a step that needs `Needs` receives. */
export type StepContext<Needs extends object = NoContext> = BaseContext & Needs

/**
 * Runs the rest of the pipeline, with the context extended by `extra` for everything inside.
 * It resolves with a response for every outcome below it and never rejects for a failure there.
 * It may be called once per step invocation; a second call throws, which is the calling step's own fault.
 * A step whose `Adds` has a required key must pass it: `next()` does not compile, but `next(undefined)` does without `strictNullChecks`, and then nothing is added.
 * A step that rewrites bodies handles a buffer and returns a stream or an empty body untouched, and a step that drops the response it was given and returns another destroys the dropped one's stream.
 */
export type Next<Adds extends object = NoContext> = (
  ...extra: NoContext extends Adds ? [extra?: Adds] : [extra: Adds]
) => Promise<ServiceResponse>

/** A response, now or later. */
export type StepResult = ServiceResponse | Promise<ServiceResponse>

/**
 * One asynchronous link of the pipeline, outermost first: `Needs` is what it reads from the context, `Adds` what it hands to everything inside it.
 * A step that needs a key checks that the key is there, and throws when it is not, before it uses it: without `strictFunctionTypes` a pipeline that lacks the step which adds the key still compiles.
 */
export type Step<Needs extends object = NoContext, Adds extends object = NoContext> = (
  request: ServiceRequest,
  context: StepContext<Needs>,
  next: Next<Adds>
) => StepResult

/** A terminal: answers the request and never delegates. `Params` is the shape of `request.params`. */
export type Handler<Needs extends object = NoContext, Params extends object = RouteParams> = (
  request: ServiceRequest<Params>,
  context: StepContext<Needs>
) => StepResult
