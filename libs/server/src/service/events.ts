import { max, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** How an exchange ended. Only `sent` means the client was given the whole response. */
export type RequestOutcome = 'sent' | 'client-closed' | 'request-timeout' | 'write-stalled' | 'write-failed' | 'shutdown'

/** One per request that reached the listener, emitted when its response or its connection has closed, whichever comes first. */
export interface RequestEvent {
  /** The discriminant. */
  readonly type: 'request'
  /** The request method. */
  readonly method: string
  /** The name of the route that claimed the request, or `null`. */
  readonly route: string | null
  /** The canonical path, only when no route claimed the request, which includes a request a step refused ahead of a router; `null` for a refused target. A bearer value or a capability therefore goes in a header or in the body, never in a path. */
  readonly path: string | null
  /** The status of the head that was written, or 0 when none was. */
  readonly status: number
  /** How the exchange ended. */
  readonly outcome: RequestOutcome
  /** Whole milliseconds from the request's arrival to its end, on the injected clock; never negative. */
  readonly durationMs: number
  /** What steps annotated, `route` excluded. A rendered `HttpError` adds its code under `failure`. */
  readonly annotations: Readonly<Record<string, string | number | boolean>>
}

/** A fault and where it happened. It carries a code and the thrown error's name, never its message and nothing from the request beyond the method and the route or path. */
export interface FailureEvent {
  /** The discriminant. */
  readonly type: 'failure'
  /** What failed: one of the kernel's codes, or the code a step passed to `context.report`. */
  readonly code: string
  /** The thrown `Error`'s `name` when it is a plain identifier, else `unknown`. */
  readonly name: string
  /** The request method, or `null` for a fault of a connection or of the server itself. */
  readonly method: string | null
  /** The route name, when one had claimed the request. */
  readonly route: string | null
  /** The canonical path, only when no route had claimed the request. */
  readonly path: string | null
}

/** Everything a service reports. */
export type ServiceEvent = RequestEvent | FailureEvent

// note: An error name that may reach a log: an identifier, with dots for a namespaced one, of at most 64 characters.
const ERROR_NAME = /^[A-Za-z][A-Za-z0-9_$.]{0,63}$/

// note: A value that is written as it is: nothing a reader splitting a line on spaces and equals signs could misread.
const BARE_VALUE = /^[A-Za-z0-9_.:/@+-]{1,256}$/

// note: Every UTF-16 unit a quoted value may not hold as it is: the quote, the backslash, and anything outside printable ASCII.
const ESCAPED_UNIT = /["\\]|[^ -~]/g

// note: The longest value a line carries, in UTF-16 units; the rest is cut.
const VALUE_UNITS = 256

/**
 * Names a thrown value for an event. Only an `Error` names itself, and only with a plain identifier:
 * an object parsed from input would otherwise let a client choose a log field. The message never takes part.
 *
 * @param value - Whatever was thrown, rejected with or reported.
 * @returns The error's own name, or `unknown`; it never throws.
 *
 * @example Naming what a step threw
 * ```typescript
 * errorName(new RangeError('the offset 9 is past the end')) // 'RangeError'
 * errorName({ name: 'admin logged in' }) // 'unknown'
 * errorName('a thrown string') // 'unknown'
 * ```
 */
export function errorName(value: unknown): string {
  try {
    if (value instanceof Error) {
      const name: unknown = value.name
      return typeof name === 'string' && ERROR_NAME.test(name) ? name : 'unknown'
    }
  } catch {
    // why: a getter or a proxy trap may throw while the value is read, and whoever reports a fault must still get a name for it
  }
  return 'unknown'
}

/**
 * Measures the whole milliseconds between two readings of a clock. A clock that stepped backwards gives 0, never a negative number.
 *
 * @param start - The earlier reading.
 * @param end - The later reading.
 * @returns The rounded difference, at least 0.
 *
 * @example Measuring across a clock that was set back
 * ```typescript
 * duration(1000, 1041.6) // 42
 * duration(1041.6, 1000) // 0
 * ```
 */
export function duration(start: number, end: number): number {
  return max(0, round(end - start))
}

/**
 * Receives what a sink's promise rejected with and drops it.
 *
 * @returns Nothing; the handler exists only so that the rejection has one.
 */
const ignoreRejection = (): undefined => undefined

/**
 * Hands one event to a service's sink and never fails for it: a sink that throws is ignored, and a promise it returns
 * is given a rejection handler and never awaited, so a log shipper that fails cannot end the process. No sink means silence.
 *
 * @param sink - Where the service's events go, or `undefined` for nowhere.
 * @param event - The request event or failure event to deliver.
 *
 * @example Delivering to a shipper that may reject
 * ```typescript
 * emitEvent(async (event) => void (await ship(event)), requestEvent)
 * emitEvent(undefined, requestEvent) // nothing happens
 * ```
 */
export function emitEvent(sink: ((event: ServiceEvent) => void) | undefined, event: ServiceEvent): void {
  try {
    // why: the sink is typed as returning nothing, but an async function is assignable to it and is the natural way to write a shipper
    const returned = sink?.(event) as unknown as PromiseLike<unknown> | null | undefined
    if (typeof returned?.then === 'function') {
      returned.then(undefined, ignoreRejection)
    }
  } catch {
    // why: a sink is the consumer's code, and its failure must never reach the connection that happened to cause the event
  }
}

/**
 * Writes one unit of a quoted value so that it can neither end the quotes nor break the line.
 *
 * @param unit - A quote, a backslash, or a UTF-16 unit outside printable ASCII.
 * @returns The quote or backslash behind a backslash, or the unit as four hexadecimal digits.
 */
function escapeUnit(unit: string): string {
  return unit === '"' || unit === '\\' ? `\\${unit}` : `\\u${unit.charCodeAt(0).toString(16).padStart(4, '0')}`
}

/**
 * Writes a value for a line: bare when it is a short word of safe characters, else cut and quoted.
 *
 * @param value - A field's value or an annotation's name.
 * @returns Text without a space, a line break or a control character outside quotes, and without the last two anywhere.
 */
function writeValue(value: string | number | boolean): string {
  const text = `${value}`
  return BARE_VALUE.test(text) ? text : `"${text.slice(0, VALUE_UNITS).replace(ESCAPED_UNIT, escapeUnit)}"`
}

/**
 * Writes one field of a line, or nothing for a field the event does not have.
 *
 * @param name - The field's key on the line.
 * @param value - What the event carries, or `null`.
 * @returns One `key=value` entry, or none.
 */
function field(name: string, value: string | number | null): string[] {
  return value === null ? [] : [`${name}=${writeValue(value)}`]
}

/**
 * Formats an event as one line of `key=value` fields, with control characters escaped and long values cut.
 * The line is for people and for searching; code that needs a field reads the event.
 *
 * @param event - A request event or a failure event, as the service's sink receives it.
 * @returns One line without a line break. A field that is `null` is left out, and `path` stands in for `route` when no route claimed the request.
 *
 * @example Writing every event of a service to standard output
 * ```typescript
 * import type { ServiceEvent } from '@hyperfrontend/server'
 * import { formatEvent } from '@hyperfrontend/server'
 *
 * const report = (event: ServiceEvent): void => void process.stdout.write(`${formatEvent(event)}\n`)
 * // request method=GET route=hello status=200 outcome=sent ms=3
 * // request method=POST path="/a b" status=413 outcome=sent ms=2 failure=body-too-large
 * // failure code=step-failed name=TypeError method=GET route=hello
 * ```
 */
export function formatEvent(event: ServiceEvent): string {
  const place = event.route === null ? field('path', event.path) : field('route', event.route)
  if (event.type === 'failure') {
    return ['failure', ...field('code', event.code), ...field('name', event.name), ...field('method', event.method), ...place].join(' ')
  }
  return [
    'request',
    ...field('method', event.method),
    ...place,
    ...field('status', event.status),
    ...field('outcome', event.outcome),
    ...field('ms', event.durationMs),
    ...entries(event.annotations).map(([name, value]) => `${writeValue(name)}=${writeValue(value)}`),
  ].join(' ')
}
