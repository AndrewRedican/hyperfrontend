import { validateHeaderValue } from 'node:http'
import { Readable } from 'node:stream'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { isInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createWeakSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-set'
import { headersProblem } from './headers'

// note: The streams that already carry the kernel's error listener, so a response passing several boundaries gathers one listener, not one per boundary.
const guarded = createWeakSet<Readable>()

/**
 * Receives a stream's error and does nothing with it.
 *
 * @returns Nothing; the listener exists only so that the error has one.
 */
const ignoreError = (): undefined => undefined

/**
 * Reports whether a value can go out as one `Set-Cookie` line.
 *
 * @param cookie - One entry of a response's cookies.
 * @returns `true` for a non-empty string Node accepts as a header value.
 */
function isCookie(cookie: unknown): boolean {
  if (typeof cookie !== 'string' || cookie === '') {
    return false
  }
  try {
    validateHeaderValue('Set-Cookie', cookie)
    return true
  } catch {
    return false
  }
}

/**
 * Judges the fields of a value that is known to be an object.
 *
 * @param response - The object a step returned.
 * @returns A fixed sentence for the first problem, or `null`.
 */
function fieldsProblem(response: Record<string, unknown>): string | null {
  const { status, cookies, body } = response
  if (!isInteger(status) || (status as number) < 200 || (status as number) > 599) {
    return 'the status is not an integer between 200 and 599'
  }
  const inHeaders = headersProblem(response['headers'])
  if (inHeaders !== null) {
    return inHeaders
  }
  if (cookies !== undefined && !isArray(cookies)) {
    return 'the cookies are not an array'
  }
  if (isArray(cookies) && !cookies.every(isCookie)) {
    return 'a cookie is not a valid header value'
  }
  return body === null || Buffer.isBuffer(body) || body instanceof Readable ? null : 'the body is not bytes, a stream or null'
}

/**
 * Finds what stops a value from being written as a response: it must be an object with a status from 200 to 599,
 * headers that keep the header rules, cookies that are non-empty header values, and a body of bytes, a stream or `null`.
 * The sentence returned is fixed text and holds nothing of the value. It never throws.
 *
 * @param value - Whatever a step returned or a failure rendered to.
 * @returns A fixed sentence for the first problem, or `null` when the value is a valid response.
 *
 * @example Refusing a response whose headers are a Map
 * ```typescript
 * responseProblem({ status: 200, headers: {}, body: null }) // null
 * responseProblem({ status: 200, headers: new Map(), body: null }) // 'the headers are not a plain object'
 * ```
 */
export function responseProblem(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return 'the response is not an object'
  }
  try {
    return fieldsProblem(value as Record<string, unknown>)
  } catch {
    // why: a getter or a proxy trap may throw while the value is read, and a check that throws would escape the boundary that called it
    return 'the response could not be read'
  }
}

/**
 * Reports whether a stream body can no longer be written from its start: it was destroyed, read to its end, read from, or it failed.
 * Such a stream never emits the chunk or the end a writer waits for. A stream that is only being piped into is still fresh.
 *
 * @param body - The stream a response carries.
 * @returns `true` when the stream is stale.
 *
 * @example Telling a used stream from a new one
 * ```typescript
 * const body = Readable.from(['chunk'])
 * isStale(body) // false
 * body.read()
 * isStale(body) // true
 * ```
 */
export function isStale(body: Readable): boolean {
  return body.destroyed || body.readableEnded || body.readableDidRead || body.errored !== null
}

/**
 * Attaches the kernel's own no-op `error` listener to a stream, once per stream, so a failure while nothing else listens is not an uncaught exception.
 * It changes nothing a consumer sees: `pipeline()`, `for await` and other listeners still receive the error.
 *
 * @param stream - A stream the kernel holds or hands out.
 *
 * @example Holding a stream body between a handler and the writer
 * ```typescript
 * guardStream(response.body)
 * guardStream(response.body) // still one listener
 * ```
 */
export function guardStream(stream: Readable): void {
  if (guarded.has(stream)) {
    return
  }
  guarded.add(stream)
  stream.on('error', ignoreError)
}

/**
 * Releases what a discarded value holds: a stream, or the stream body of a response, is given the kernel's error listener and destroyed.
 * Anything else, a value that is no response at all included, is left alone. It never throws.
 * Destroying releases the stream, not what feeds it.
 *
 * @param value - A response that will not be written, its stream body, or whatever a step returned in place of one.
 *
 * @example Dropping a response that arrived after its exchange ended
 * ```typescript
 * releaseBody({ status: 200, headers: {}, body: Readable.from(['late']) })
 * ```
 */
export function releaseBody(value: unknown): void {
  try {
    const body: unknown = value instanceof Readable ? value : (value as Record<string, unknown>)['body']
    if (body instanceof Readable) {
      guardStream(body)
      body.destroy()
    }
  } catch {
    // why: the value may be nothing at all, or its body a getter that throws; either way there is nothing to release
  }
}
