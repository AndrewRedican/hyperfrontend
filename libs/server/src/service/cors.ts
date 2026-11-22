import type { ServiceResponse, Step } from './contract'
import type { Method } from './router'
import { validateHeaderName } from 'node:http'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { appendVary, setHeader } from './headers'
import { httpError } from './http-error'

/** What a browser on another origin may do. */
export interface CorsOptions {
  /** Origins granted, compared exactly as serialised (`https://site.example`). There is no wildcard. */
  readonly origins: readonly string[]
  /** Methods a preflight is granted; `GET` and `HEAD` when omitted. A browser preflights `QUERY`, which is not a safelisted method, so list it for a `QUERY` route a page on another origin calls. */
  readonly methods?: readonly Method[]
  /** Request headers a preflight is granted; none when omitted. */
  readonly headers?: readonly string[]
  /** Seconds a browser may cache a preflight; 600 when omitted. */
  readonly maxAgeSeconds?: number
  /** Whether credentialed requests are granted; `false` when omitted. */
  readonly credentials?: boolean
}

/** The options of a cors step, checked and turned into what each answer needs. */
interface CorsPlan {
  /** The origins granted, copied so that a later change to the options grants nothing. */
  readonly origins: readonly string[]
  /** Whether credentialed requests are granted. */
  readonly credentials: boolean
  /** The headers a granted preflight carries after the origin, in the order they are sent. */
  readonly preflight: Readonly<Record<string, string>>
}

// note: Every method a preflight may be granted, in the order the refusal of another one lists them.
const METHODS: readonly string[] = freeze(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'QUERY', 'OPTIONS'])

// note: The longest a browser is asked to keep a preflight: one day.
const LONGEST_MAX_AGE = 86400

/**
 * Reports whether a value is an origin as a browser serialises it in the `Origin` header: a scheme, a host and a port that is not the scheme's own.
 *
 * @param entry - The value offered as an origin.
 * @returns `true` for a string that parses as a URL whose origin is the string itself.
 */
function isSerialisedOrigin(entry: unknown): boolean {
  try {
    return createURL(entry as string).origin === entry
  } catch {
    // why: the parser's error quotes its input, and all that matters here is that the entry is no origin
    return false
  }
}

/**
 * Reports whether a value is a name Node would send as a header.
 *
 * @param entry - The value offered as a header name.
 * @returns `true` for a string of token characters.
 */
function isHeaderName(entry: unknown): boolean {
  try {
    validateHeaderName(entry as string)
    return true
  } catch {
    return false
  }
}

/**
 * Lists the entries of an optional list that fail a test.
 *
 * @param option - The option the list was given under.
 * @param list - The value given, which no compiler need have seen.
 * @param accepts - Tells whether one entry is sound.
 * @param expected - What ends the problem line of a refused entry.
 * @returns One line for a value that is no array, else one line per refused entry, a hole included.
 */
function listProblems(option: string, list: unknown, accepts: (entry: unknown) => boolean, expected: string): string[] {
  if (!isArray(list)) {
    return [`"${option}" must be an array.`]
  }
  // how: spreading turns a hole into `undefined`, which no test accepts, where a plain walk would skip it
  return [...list].flatMap((entry, index) => (accepts(entry) ? [] : [`"${option}[${index}]" ${expected}`]))
}

/**
 * Checks the options of a cors step and prepares what its answers carry.
 *
 * @param options - The options as given, which no compiler need have seen.
 * @returns The origins, whether credentials are granted, and the fixed headers of a granted preflight.
 * @throws {Error} Once, naming every faulty option in the order origins, methods, headers, max age, credentials.
 */
function planCors(options: CorsOptions): CorsPlan {
  const { origins, methods = ['GET', 'HEAD'], headers = [], maxAgeSeconds = 600, credentials = false } = options
  const problems: string[] = [
    ...(isArray(origins) && origins.length > 0
      ? listProblems('origins', origins, isSerialisedOrigin, 'must be a serialised origin such as "https://site.example".')
      : ['"origins" must be a non-empty array.']),
    ...listProblems('methods', methods, (entry) => METHODS.includes(entry as string), `must be one of ${METHODS.join(', ')}.`),
    ...listProblems('headers', headers, isHeaderName, 'must be a header name.'),
    ...(isInteger(maxAgeSeconds) && maxAgeSeconds >= 0 && maxAgeSeconds <= LONGEST_MAX_AGE
      ? []
      : ['"maxAgeSeconds" must be an integer between 0 and 86400.']),
    ...(typeof credentials === 'boolean' ? [] : ['"credentials" must be a boolean.']),
  ]
  if (problems.length > 0) {
    throw createError(['Invalid cors options:', ...problems.map((problem) => `  - ${problem}`)].join('\n'))
  }
  return {
    origins: freeze([...origins]),
    credentials,
    preflight: freeze({
      'Access-Control-Allow-Methods': methods.join(', '),
      ...(headers.length > 0 ? { 'Access-Control-Allow-Headers': headers.join(', ') } : {}),
      'Access-Control-Max-Age': `${maxAgeSeconds}`,
      ...(credentials ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
      Vary: 'Origin',
    }),
  }
}

/**
 * Answers preflights itself and marks every response that passes through it, failures included. An origin off the list is never reflected.
 * It tells browsers what to allow; it is not an access control. Throws once at construction, naming every invalid option.
 * A preflight is an `OPTIONS` request with an `Origin` and an `Access-Control-Request-Method` header: a listed origin is answered 204 with the grant,
 * any other 403, and the rest of the pipeline does not run. Every other request runs on, and its response gains `Vary: Origin` and, for a listed origin, the grant.
 * Place it ahead of the router, which answers 405 to an `OPTIONS` request no route declares, and outside every step whose answers a browser on another origin must be able to read.
 * A request from an origin off the list still runs and is answered, without the grant, and a client that is no browser ignores the headers altogether: decide who may call a route in a step of your own.
 *
 * @param options - The origins granted, and what a preflight is told about methods, request headers, caching and credentials.
 * @returns The step.
 * @throws {Error} `Invalid cors options:` and one line per problem.
 *
 * @example Letting the site's origin read an API with its cookies
 * ```typescript
 * import { cors, startService } from '@hyperfrontend/server'
 *
 * const fromSite = cors({ origins: ['https://site.example'], methods: ['GET', 'POST'], headers: ['Content-Type'], credentials: true })
 * const service = await startService({ port: 8080, steps: [fromSite, api] })
 * // a preflight from https://site.example answers 204 with Access-Control-Allow-Methods: GET, POST
 * // a 401 thrown inside api still carries Access-Control-Allow-Origin, so the page can read it
 * // a preflight from any other origin answers 403, and its other requests gain only Vary: Origin
 * ```
 *
 * @example Listing an origin exactly as a browser sends it
 * ```typescript
 * import { cors } from '@hyperfrontend/server'
 *
 * cors({ origins: ['https://site.example/'] })
 * // throws: "origins[0]" must be a serialised origin such as "https://site.example".
 * ```
 */
export function cors(options: CorsOptions): Step {
  const { origins, credentials, preflight } = planCors(options)
  const mark = (response: ServiceResponse, origin: string | undefined): ServiceResponse => {
    let headers = response.headers
    if (origin !== undefined && origins.includes(origin)) {
      headers = setHeader(headers, 'Access-Control-Allow-Origin', origin)
      headers = credentials ? setHeader(headers, 'Access-Control-Allow-Credentials', 'true') : headers
    }
    return { ...response, headers: appendVary(headers, 'Origin') }
  }
  return (request, _context, next) => {
    const { origin } = request.headers
    if (request.method !== 'OPTIONS' || origin === undefined || request.headers['access-control-request-method'] === undefined) {
      return next().then((response) => mark(response, origin))
    }
    if (!origins.includes(origin)) {
      throw httpError(403, 'origin-not-allowed', { Vary: 'Origin' })
    }
    return { status: 204, headers: { 'Access-Control-Allow-Origin': origin, ...preflight }, body: null }
  }
}
