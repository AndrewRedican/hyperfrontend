import type { ClockDeps, ServiceClock } from './clock'
import type { Handler, NoContext, ServiceRequest, ServiceResponse, Step, StepContext, StepResult } from './contract'
import type { Method } from './route-methods'
import type { ParsedPattern, PathParams } from './route-pattern'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { isInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { freeze, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { systemClock } from './clock'
import { isPlainObject } from './headers'
import { httpError } from './http-error'
import { releaseBody } from './response-check'
import { ROUTE_METHODS, methodProblem } from './route-methods'
import { comparePatterns, isStaticPattern, matchPattern, parsePattern } from './route-pattern'

export type { Method } from './route-methods'

/** Per-route options. */
export interface RouteOptions {
  /** A deadline for this route's handler, in milliseconds. Off unless set: past it the client gets 503 and the handler's `signal` aborts. It covers the time to a returned response, not the writing of a stream body. */
  readonly timeoutMs?: number
}

/** One row of a route table; built by `route`. Its name is the key it sits under in the table. */
export interface Route<Needs extends object = NoContext> {
  /** The method the route answers; a `GET` route also answers `HEAD`, and no other route does. */
  readonly method: Method
  /** The pattern as written, before any prefix. */
  readonly pattern: string
  /** The handler deadline, or `undefined` for none. */
  readonly timeoutMs: number | undefined
  /** The handler, with its params type erased; the params were checked where the route was declared. */
  readonly handler: Handler<Needs, never>
}

/** Table-wide options. */
export interface RouterOptions {
  /** A static prefix put in front of every pattern, for example `/api`. A deployment convenience, not a control. */
  readonly prefix?: string
}

/** A handler as the router calls it: what it needs from the context and from the params was settled where its route was declared. */
type LooseHandler = Handler<object, never>

/** One route of a table, ready to be matched. */
interface Entry {
  /** The key the route sits under in the table. */
  readonly name: string
  /** The method the route answers. */
  readonly method: Method
  /** The prefix followed by the route's own pattern, parsed. */
  readonly pattern: ParsedPattern
  /** The route's own pattern with every param name dropped. */
  readonly shape: string
  /** The handler deadline, or `undefined` for none. */
  readonly timeoutMs: number | undefined
  /** The handler. */
  readonly handler: LooseHandler
}

/** A route whose pattern matches the path of a request. */
interface Match {
  /** The route. */
  readonly entry: Entry
  /** The decoded values its pattern read from the path, in an object without a prototype. */
  readonly params: Record<string, string>
}

// note: A route name reaches the log as the route of a request, so it is a short word a line can be searched for.
const ROUTE_NAME = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/

// note: The longest delay a timer keeps; a longer one would fire at once.
const LONGEST_TIMEOUT = 2147483647

// note: What stands for a param and for a wildcard in a shape. Static text never starts with either character, so a shape reads one way only.
const NAMELESS = freeze({ param: ':', wildcard: '*' })

/**
 * Declares a route. The handler's `request.params` is typed from the pattern literal: `'/tickets/:id/files/*rest'` gives `id` and `rest`.
 * A handler written apart from its pattern is typed by a shape instead and checks that each param it uses is a string, because a compiler
 * without the strict flags accepts it on a pattern that declares only some of them. A param joined onto a directory is checked first and the result still confined with `confineDecodedPath`.
 * Nothing is validated here: every check is the router's.
 *
 * @param method - The method the route answers; a `GET` route also answers `HEAD`, and a `QUERY` route reads its question from `request.body`.
 * @param pattern - `/`, or segments each led by a slash: static text, `:name` for one path segment, or `*name`, last, for the rest of the path.
 * @param handler - Answers the request; it never delegates.
 * @param options - A deadline for the handler; none when omitted.
 * @returns The frozen route, to put under its name in a router's table.
 *
 * @example Reading typed params
 * ```typescript
 * import { jsonResponse, route } from '@hyperfrontend/server'
 *
 * const readFile = route('GET', '/tickets/:id/files/*rest', (request) =>
 *   jsonResponse(200, { ticket: request.params.id, file: request.params.rest })
 * )
 * // GET /tickets/7/files/logs/boot.txt answers { "ticket": "7", "file": "logs/boot.txt" }
 * ```
 *
 * @example Giving one slow handler a deadline
 * ```typescript
 * import { jsonResponse, route } from '@hyperfrontend/server'
 *
 * const report = route('GET', '/reports/:year', async (request, context) => jsonResponse(200, await build(request.params.year, context.signal)), {
 *   timeoutMs: 5000,
 * })
 * // past five seconds the client gets 503 and context.signal aborts; the handler is told, not stopped
 * ```
 *
 * @example Answering a QUERY, whose question arrives in the body
 * ```typescript
 * import { jsonResponse, route } from '@hyperfrontend/server'
 *
 * const search = route('QUERY', '/tickets', async (request) => jsonResponse(200, await find(await request.body.json()), { 'Accept-Query': 'application/json' }))
 * // a question not declared as JSON answers 415; a router refuses the route on a Node.js whose HTTP parser does not know QUERY
 * ```
 */
export function route<Path extends string, Needs extends object = NoContext>(
  method: Method,
  pattern: Path,
  handler: Handler<Needs, PathParams<Path>>,
  options?: RouteOptions
): Route<Needs> {
  return freeze({ method, pattern, timeoutMs: options?.timeoutMs, handler })
}

/**
 * Reads the prefix of a table as segments, or records that it is faulty.
 *
 * @param options - The router's options.
 * @param problems - The problem lines of the table, which gain one for a faulty prefix.
 * @returns The static segments to put in front of every pattern; none without a prefix or for a faulty one.
 */
function prefixOf(options: RouterOptions | undefined, problems: string[]): ParsedPattern {
  const prefix = options?.prefix
  if (prefix === undefined) {
    return []
  }
  if (!isStaticPattern(prefix) || prefix === '/') {
    problems.push('prefix: must be static segments such as "/api", with no trailing "/".')
    return []
  }
  return parsePattern(prefix) as ParsedPattern
}

/**
 * Checks one value of a table and records every problem it has.
 *
 * @param name - The key the value sits under.
 * @param value - What the table holds there.
 * @param prefix - The table's prefix, as segments.
 * @param problems - The problem lines of the table, which gain one per fault of this route.
 * @returns The route ready to be matched, or `null` when it names no method or its pattern is faulty and it can be compared with no other route.
 */
function checkRoute(name: string, value: unknown, prefix: ParsedPattern, problems: string[]): Entry | null {
  if (!ROUTE_NAME.test(name)) {
    problems.push(
      `${name}: a route name must be 1 to 64 characters of letters, digits, ".", "_", ":" or "-", starting with a letter or digit.`
    )
  }
  if (!isPlainObject(value)) {
    problems.push(`${name}: not a route; build it with route().`)
    return null
  }
  const { method, timeoutMs, handler } = value
  const parsed = parsePattern(value['pattern'])
  const known = ROUTE_METHODS.includes(method as Method)
  const unreachable = methodProblem(method)
  if (unreachable !== null) {
    problems.push(`${name}: ${unreachable}`)
  }
  if (typeof parsed === 'string') {
    problems.push(`${name}: ${parsed}`)
  }
  if (timeoutMs !== undefined && !(isInteger(timeoutMs) && (timeoutMs as number) >= 1 && (timeoutMs as number) <= LONGEST_TIMEOUT)) {
    problems.push(`${name}: "timeoutMs" must be a positive integer.`)
  }
  if (typeof handler !== 'function') {
    problems.push(`${name}: the handler must be a function.`)
  }
  if (!known || typeof parsed === 'string') {
    return null
  }
  return {
    name,
    method: method as Method,
    pattern: [...prefix, ...parsed],
    shape: parsed.map((segment) => (segment.kind === 'static' ? segment.text : NAMELESS[segment.kind])).join('/'),
    timeoutMs: timeoutMs as number | undefined,
    handler: handler as LooseHandler,
  }
}

/**
 * Finds the routes no request could choose between: two of one method whose patterns have the same shape.
 *
 * @param entries - The routes whose method and pattern are sound, in ascending order of name.
 * @returns One problem line per route that repeats an earlier one, naming the first route of that method and shape.
 */
function ambiguities(entries: readonly Entry[]): string[] {
  const first = createMap<string, string>()
  return entries.flatMap((entry) => {
    const key = `${entry.method} ${entry.shape}`
    const earlier = first.get(key)
    if (earlier === undefined) {
      first.set(key, entry.name)
      return []
    }
    return [`${earlier} and ${entry.name}: the same method and shape.`]
  })
}

/**
 * Checks a whole table and puts its routes in the order they are tried.
 *
 * @param table - The table, keyed by route name; its values may be anything.
 * @param options - The router's options.
 * @returns The routes, the most specific first; routes of one shape stand in ascending order of name.
 * @throws {Error} Once, naming the faulty prefix, every fault of every route by ascending name, then every ambiguity.
 */
function compile(table: Readonly<Record<string, unknown>>, options: RouterOptions | undefined): readonly Entry[] {
  const problems: string[] = []
  const prefix = prefixOf(options, problems)
  // note: a plain sort orders names by UTF-16 code unit, never by locale
  const entries = keys(table)
    .sort()
    .flatMap((name) => checkRoute(name, table[name], prefix, problems) ?? [])
  problems.push(...ambiguities(entries))
  if (problems.length > 0) {
    throw createError(['Invalid routes:', ...problems.map((problem) => `  - ${problem}`)].join('\n'))
  }
  // how: the sort is stable, so routes that tie keep the ascending order of their names
  return entries.sort((a, b) => comparePatterns(a.pattern, b.pattern))
}

/**
 * Runs a handler under its route's deadline. The handler gets a signal of its own, which aborts when the deadline passes, and when the request's signal aborts at any time in the exchange, after the handler returned included.
 * The deadline covers the time to a returned response: its timer is cleared when the handler settles and when the request's signal aborts, whichever comes first.
 * Past the deadline the handler is told, not stopped: what it returns later is released, and what it throws later is dropped.
 *
 * @param handler - The route's handler.
 * @param timeoutMs - The route's deadline, in milliseconds.
 * @param request - The request the handler receives.
 * @param context - The context of the router, whose signal is the request's.
 * @param clock - The clock the timer runs on.
 * @returns A promise for the handler's response; it rejects with the handler's own failure, or with a 503 `handler-timeout` at the deadline.
 */
function runWithDeadline(
  handler: LooseHandler,
  timeoutMs: number,
  request: ServiceRequest<never>,
  context: StepContext<object>,
  clock: ServiceClock
): Promise<ServiceResponse> {
  const controller = new AbortController()
  return createPromise<ServiceResponse>((resolve, reject) => {
    let armed = true
    let expired = false
    const timer = clock.setTimeout(() => {
      expired = true
      context.signal.removeEventListener('abort', follow)
      controller.abort()
      reject(httpError(503, 'handler-timeout'))
    }, timeoutMs)
    const disarm = (): void => {
      if (armed) {
        armed = false
        clock.clearTimeout(timer)
      }
    }
    // why: an exchange that ended waits for no response, and a timer left armed for a handler that never settles would keep the process of a closed service alive
    const follow = (): void => {
      disarm()
      controller.abort()
    }
    if (context.signal.aborted) {
      follow()
    } else {
      // why: the listener outlives the handler's return, so a handler that streams is told of the end of its exchange as it is on a route without a deadline; the request's signal belongs to one exchange and takes the listener with it
      context.signal.addEventListener('abort', follow, { once: true })
    }
    // why: the handler runs inside a promise so that a throw and a rejection arrive the same way
    createPromise<ServiceResponse>((answer) => answer(handler(request, freeze({ ...context, signal: controller.signal })))).then(
      (response) => {
        if (expired) {
          releaseBody(response)
          return
        }
        disarm()
        resolve(response)
      },
      (error: unknown) => {
        if (!expired) {
          disarm()
          reject(error)
        }
      }
    )
  })
}

/**
 * Lists the methods a path answers to, for the `Allow` header of a wrong-method refusal.
 *
 * @param matching - The routes whose pattern matches the path.
 * @returns The methods of those routes, and `HEAD` beside `GET`, in the fixed order, joined with a comma and a space.
 */
function allowOf(matching: readonly Match[]): string {
  return ROUTE_METHODS.filter((method) =>
    matching.some(({ entry }) => entry.method === method || (method === 'HEAD' && entry.method === 'GET'))
  ).join(', ')
}

/**
 * Finds the routes that know a path, under any method.
 *
 * @param entries - The routes of the table, the most specific first.
 * @param requestPath - The canonical path of the request.
 * @returns Every route whose pattern matches, in the same order, each with the params it read.
 */
function matchesOf(entries: readonly Entry[], requestPath: string): Match[] {
  const segments = requestPath.slice(1).split('/')
  return entries.flatMap((entry) => {
    const params = matchPattern(entry.pattern, segments)
    return params === null ? [] : [{ entry, params }]
  })
}

/**
 * The step that dispatches by method and path over a table keyed by route name.
 * No path match delegates to `next()`; a path that matches under another method answers 405 with `Allow`.
 * The route's name, never its path, is what the request's event carries once a route knows the path.
 * Throws once at construction, naming every faulty or ambiguous route, and every route whose method the HTTP parser of the running Node.js does not know: that parser answers 400 itself, so the route could never be reached.
 * Every route of one path belongs to one table: a router answers the 405 itself, which is what makes `Allow` list every method of the path, so a second router or `staticFiles` after it is never asked about a path it knows.
 * A route a step must precede takes `guard` in that table, where a second, chained router for the same path would never be reached.
 *
 * @param table - The routes, each under its name: 1 to 64 letters, digits, `.`, `_`, `:` or `-`, starting with a letter or a digit.
 * @param options - A static prefix for every pattern; none when omitted.
 * @param deps - The clock route deadlines run on; the system clock when omitted.
 * @returns The step. Among the routes that match a path the most specific wins, whatever the order of the table: static text before a param, a param before a wildcard, compared from the left.
 * @throws {Error} `Invalid routes:` and one line per problem of the prefix, of each route by ascending name, a method this version of Node.js does not parse included, and of each pair of routes with the same method and shape.
 *
 * @example Routing a small service
 * ```typescript
 * import { jsonResponse, route, router } from '@hyperfrontend/server'
 *
 * const api = router(
 *   {
 *     'tickets.list': route('GET', '/tickets', () => jsonResponse(200, [])),
 *     'tickets.read': route('GET', '/tickets/:id', (request) => jsonResponse(200, { id: request.params.id })),
 *     'tickets.create': route('POST', '/tickets', async (request) => jsonResponse(201, await request.body.json())),
 *   },
 *   { prefix: '/api' }
 * )
 * // GET /api/tickets/7 answers { "id": "7" }, and its event carries route=tickets.read, never the path
 * // DELETE /api/tickets/7 answers 405 with Allow: GET, HEAD
 * // GET /elsewhere goes to the next step, and to a 404 when there is none
 * ```
 *
 * @example Keeping a refused path out of the log with a guarded route
 * ```typescript
 * import { guard, jsonResponse, route, router } from '@hyperfrontend/server'
 *
 * const api = router({
 *   'reports.read': route('GET', '/reports/:id', guard(requireIdentity, (request) => jsonResponse(200, { id: request.params.id }))),
 * })
 * // the router names the route before the guard runs, so a 401 from it is logged as route=reports.read
 * ```
 */
export function router<Needs extends object = NoContext>(
  table: Readonly<Record<string, Route<Needs>>>,
  options?: RouterOptions,
  deps?: ClockDeps
): Step<Needs> {
  const entries = compile(table, options)
  const clock = deps?.clock ?? systemClock
  return (request, context, next): StepResult => {
    const matching = matchesOf(entries, request.path)
    const [known] = matching
    if (known === undefined) {
      return next()
    }
    const chosen =
      matching.find(({ entry }) => entry.method === request.method) ??
      (request.method === 'HEAD' ? matching.find(({ entry }) => entry.method === 'GET') : undefined)
    // why: the route is named before anything can refuse the request, so the path of a known route never reaches an event
    context.annotate('route', (chosen ?? known).entry.name)
    if (chosen === undefined) {
      throw httpError(405, 'method-not-allowed', { Allow: allowOf(matching) })
    }
    const { entry } = chosen
    const dispatched = freeze({ ...request, params: freeze(chosen.params) }) as ServiceRequest<never>
    return entry.timeoutMs === undefined
      ? entry.handler(dispatched, context)
      : runWithDeadline(entry.handler, entry.timeoutMs, dispatched, context, clock)
  }
}
