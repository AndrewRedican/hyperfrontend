import type { Step } from './contract'
import type { ServiceOptions } from './service'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isInteger, isSafeInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** The options of a service with every bound filled in. */
export interface ResolvedServiceOptions {
  /** The pipeline, outermost first, copied when the options were resolved. */
  readonly steps: readonly Step[]
  /** The port to bind; 0 lets the operating system choose. */
  readonly port: number
  /** The interface to bind, or `undefined` for every interface. */
  readonly host: string | undefined
  /** The cap of the body's buffering readers when a call gives none, in bytes. */
  readonly bodyBytes: number
  /** Time allowed for a complete header block, in milliseconds. */
  readonly headersTimeoutMs: number
  /** Time allowed to receive one whole request, in milliseconds. */
  readonly requestTimeoutMs: number
  /** How long an idle kept-alive connection stays open, in milliseconds. */
  readonly keepAliveTimeoutMs: number
  /** How long a response write may wait for the client to take bytes, in milliseconds. */
  readonly writeIdleTimeoutMs: number
  /** How long a shutdown lets requests in flight run, in milliseconds. */
  readonly graceMs: number
  /** How many forwarding hops are believed when the client's address is read. */
  readonly trustedProxyHops: number
}

// note: Node's timers take a signed 32-bit delay; a longer one fires after one millisecond.
const LARGEST_TIMER_MS = 2147483647

/**
 * Tells whether a value is a whole number inside a range.
 *
 * @param value - What an option was given as.
 * @param lowest - The smallest number accepted.
 * @param highest - The largest number accepted.
 * @returns `true` for an integer from `lowest` to `highest`, both included.
 */
function isIntegerBetween(value: unknown, lowest: number, highest: number): boolean {
  return isInteger(value) && (value as number) >= lowest && (value as number) <= highest
}

/**
 * Fills in the default of every bound a service did not set and validates the whole, before any server exists.
 * A bound left `undefined` takes its default; anything else is judged as given.
 *
 * @param options - The options as the service gave them.
 * @returns The options with every bound present, frozen, with a frozen copy of the steps.
 * @throws {Error} One error whose message is `Invalid service options:` followed by one line per problem, in a fixed order. No line holds an offending value.
 *
 * @example Reading the defaults of a service that set none
 * ```typescript
 * const resolved = resolveServiceOptions({ steps: [], port: 0 })
 * resolved.bodyBytes // 65536
 * resolved.requestTimeoutMs // 60000
 * ```
 *
 * @example Every problem arrives in one error
 * ```typescript
 * resolveServiceOptions({ steps: [], port: -1, graceMs: 1.5 })
 * // throws: Invalid service options:
 * //   - "port" must be an integer between 0 and 65535.
 * //   - "graceMs" must be a non-negative integer.
 * ```
 */
export function resolveServiceOptions(options: ServiceOptions): ResolvedServiceOptions {
  const {
    steps,
    port,
    host,
    bodyBytes = 65536,
    headersTimeoutMs = 10000,
    requestTimeoutMs = 60000,
    keepAliveTimeoutMs = 5000,
    writeIdleTimeoutMs = 30000,
    graceMs = 10000,
    trustedProxyHops = 0,
  } = options
  const problems: string[] = []
  if (!isArray(steps) || !steps.every((step) => typeof step === 'function')) {
    problems.push('"steps" must be an array of functions.')
  }
  if (!isIntegerBetween(port, 0, 65535)) {
    problems.push('"port" must be an integer between 0 and 65535.')
  }
  if (host !== undefined && (typeof host !== 'string' || host === '')) {
    problems.push('"host" must be a non-empty string.')
  }
  // why: the body's readers take a safe integer as their limit, so a larger cap would fail every read that relies on it
  if (!isSafeInteger(bodyBytes) || bodyBytes < 0) {
    problems.push('"bodyBytes" must be a non-negative integer.')
  }
  const timeouts = { headersTimeoutMs, requestTimeoutMs, keepAliveTimeoutMs, writeIdleTimeoutMs }
  const invalid = (['headersTimeoutMs', 'requestTimeoutMs', 'keepAliveTimeoutMs', 'writeIdleTimeoutMs'] as const).filter(
    (name) => !isIntegerBetween(timeouts[name], 1, LARGEST_TIMER_MS)
  )
  invalid.forEach((name) => problems.push(`"${name}" must be a positive integer.`))
  // why: Node 18.0.0 throws from createServer for a header time that is not below the request time, and later versions accept equal values
  if (!invalid.includes('headersTimeoutMs') && !invalid.includes('requestTimeoutMs') && headersTimeoutMs >= requestTimeoutMs) {
    problems.push('"headersTimeoutMs" must be below "requestTimeoutMs".')
  }
  if (!isIntegerBetween(graceMs, 0, LARGEST_TIMER_MS)) {
    problems.push('"graceMs" must be a non-negative integer.')
  }
  if (!isIntegerBetween(trustedProxyHops, 0, 16)) {
    problems.push('"trustedProxyHops" must be an integer between 0 and 16.')
  }
  if (problems.length > 0) {
    throw createError(['Invalid service options:', ...problems.map((problem) => `  - ${problem}`)].join('\n'))
  }
  return freeze({
    steps: freeze([...steps]),
    port,
    host,
    bodyBytes,
    headersTimeoutMs,
    requestTimeoutMs,
    keepAliveTimeoutMs,
    writeIdleTimeoutMs,
    graceMs,
    trustedProxyHops,
  })
}
