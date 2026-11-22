import type { BaseContext, Handler, Next, ServiceRequest, ServiceResponse, Step } from './contract'
import type { Method, Route, RouterOptions } from './router'
import { METHODS } from 'node:http'
import { describe, expect, it } from '@hyperfrontend/testing'
import { chain, guard, settle } from './pipeline'
import { jsonResponse } from './responses'
import { route, router } from './router'

/** A context that records what is written to it. */
interface Probe {
  /** The context handed to the router. */
  readonly context: BaseContext
  /** Every `annotate` call, in order. */
  readonly annotations: unknown[][]
}

/** What a spec asserts on after one request went through a router. */
interface Seen {
  /** The status of the response. */
  readonly status: number
  /** The `Allow` header of the response, when it has one. */
  readonly allow: string | undefined
  /** The body of the response as text, when it has one. */
  readonly body: string | undefined
  /** Every `annotate` call, in order. */
  readonly annotations: unknown[][]
  /** The arguments of every call of `next`, in order. */
  readonly delegated: unknown[][]
}

/** A `next` that records how it was called. */
interface Delegation {
  /** The function handed to the router. */
  readonly next: Next
  /** The arguments of every call, in order. */
  readonly calls: unknown[][]
}

/**
 * Builds a frozen context whose `annotate` records its calls.
 *
 * @returns The context and what it recorded.
 */
const createProbe = (): Probe => {
  const annotations: unknown[][] = []
  return {
    context: Object.freeze({
      signal: new AbortController().signal,
      client: Object.freeze({ address: '192.0.2.7' }),
      annotate: (name: string, value: string | number | boolean) => void annotations.push([name, value]),
      report: () => undefined,
    }),
    annotations,
  }
}

/**
 * Builds a `next` that answers 404 the way the end of a pipeline does, and records its calls.
 *
 * @returns The function and its recorded calls.
 */
const createDelegation = (): Delegation => {
  const calls: unknown[][] = []
  return { calls, next: (...extra) => (calls.push(extra), Promise.resolve({ status: 404, headers: {}, body: null })) }
}

/**
 * Builds a request the way the listener does: frozen, with a canonical path and empty params without a prototype.
 *
 * @param method - GET, POST and so on, as Node hands it over.
 * @param canonical - What the listener decoded the target to.
 * @returns The frozen request, with a query added to its raw target.
 */
const requestFor = (method: string, canonical: string): ServiceRequest =>
  Object.freeze({
    method,
    url: `${canonical}?page=2`,
    headers: Object.freeze(Object.create(null)),
    path: canonical,
    query: Object.freeze({}),
    params: Object.freeze(Object.create(null)),
    body: Object.freeze({ length: null }),
  }) as unknown as ServiceRequest

/**
 * Builds a handler that answers with its route's label.
 *
 * @param label - What the response body says.
 * @returns The handler.
 */
const says =
  (label: string): Handler =>
  () =>
    jsonResponse(200, label)

/**
 * Runs a router behind the boundary the listener puts around a pipeline, and gathers what a spec asserts on.
 *
 * @param step - The router.
 * @param method - The request method.
 * @param canonical - The canonical path.
 * @returns The status, the `Allow` header, the body as text, the annotations and the calls of `next`.
 */
const seen = async (step: Step, method: string, canonical: string): Promise<Seen> => {
  const probe = createProbe()
  const delegation = createDelegation()
  const response = await settle(() => step(requestFor(method, canonical), probe.context, delegation.next), probe.context)
  return {
    status: response.status,
    allow: response.headers['Allow'],
    body: response.body?.toString(),
    annotations: probe.annotations,
    delegated: delegation.calls,
  }
}

/**
 * Builds a router and returns the lines of the error it throws.
 *
 * @param table - The route table, which may hold anything.
 * @param options - The router options.
 * @returns The message split into lines, or an empty list when nothing was thrown.
 */
const refusal = (table: Record<string, unknown>, options?: RouterOptions): string[] => {
  try {
    router(table as Record<string, Route>, options)
    return []
  } catch (error) {
    return (error as Error).message.split(/\r?\n/)
  }
}

const NAME_RULE = 'a route name must be 1 to 64 characters of letters, digits, ".", "_", ":" or "-", starting with a letter or digit.'
const METHOD_RULE = 'the method must be one of GET, HEAD, POST, PUT, PATCH, DELETE, QUERY, OPTIONS.'
const UNPARSED_QUERY = 'the method QUERY is not parsed by this version of Node.js.'
const PREFIX_RULE = 'prefix: must be static segments such as "/api", with no trailing "/".'

describe('route', () => {
  it('returns the method, the pattern, the deadline and the handler', () => {
    const handler = says('ticket')
    expect(route('GET', '/tickets/:id', handler, { timeoutMs: 250 })).toEqual({
      method: 'GET',
      pattern: '/tickets/:id',
      timeoutMs: 250,
      handler,
    })
  })

  it('leaves the deadline undefined without options', () => {
    expect(route('POST', '/tickets', says('created')).timeoutMs).toBeUndefined()
  })

  it('freezes the route', () => {
    expect(Object.isFrozen(route('GET', '/', says('root')))).toBe(true)
  })

  it('validates nothing, so that every fault of a table arrives from the router', () => {
    expect(route('FETCH' as Method, 'tickets/', 7 as unknown as Handler, { timeoutMs: -1 })).toEqual({
      method: 'FETCH',
      pattern: 'tickets/',
      timeoutMs: -1,
      handler: 7,
    })
  })
})

describe('router construction', () => {
  it('accepts an empty table', () => {
    expect(refusal({})).toEqual([])
  })

  it('accepts a table whose routes differ by method, by static text or by shape', () => {
    expect(
      refusal({
        'tickets.list': route('GET', '/tickets', says('list')),
        'tickets.create': route('POST', '/tickets', says('create')),
        'tickets.read': route('GET', '/tickets/:id', says('read')),
        'tickets.open': route('GET', '/tickets/open', says('open')),
        'files.read': route('GET', '/files/*rest', says('files'), { timeoutMs: 2147483647 }),
      })
    ).toEqual([])
  })

  it('throws a plain Error', () => {
    expect(() => router({ broken: 7 as unknown as Route })).toThrow(Error)
  })

  it('names every problem in one error: the prefix, each route by ascending name, then the ambiguities', () => {
    const table = {
      zeta: route('GET', '/z/:id', says('zeta')),
      'bad name': route('GET', '/ok', says('ok')),
      beta: 'nothing',
      delta: route('FETCH' as Method, 'no-slash', 'handler' as unknown as Handler, { timeoutMs: 0 }),
      alpha: route('GET', '/z/:key', says('alpha')),
      Upper: route('GET', '/a/', says('upper')),
    }
    expect(refusal(table, { prefix: '/api/' })).toEqual([
      'Invalid routes:',
      `  - ${PREFIX_RULE}`,
      '  - Upper: the pattern must not end with "/".',
      `  - bad name: ${NAME_RULE}`,
      '  - beta: not a route; build it with route().',
      `  - delta: ${METHOD_RULE}`,
      '  - delta: the pattern must start with "/".',
      '  - delta: "timeoutMs" must be a positive integer.',
      '  - delta: the handler must be a function.',
      '  - alpha and zeta: the same method and shape.',
    ])
  })

  it('sorts route names by code unit, an upper-case letter before a lower-case one', () => {
    expect(refusal({ a: 1, B: 2, _: 3, '0': 4 })).toEqual([
      'Invalid routes:',
      '  - 0: not a route; build it with route().',
      '  - B: not a route; build it with route().',
      `  - _: ${NAME_RULE}`,
      '  - _: not a route; build it with route().',
      '  - a: not a route; build it with route().',
    ])
  })

  it.each([['/'], ['/api/'], ['api'], ['/:version'], ['/api/*rest'], [''], [7], [null]])('refuses the prefix %p', (prefix) => {
    expect(refusal({}, { prefix } as RouterOptions)).toEqual(['Invalid routes:', `  - ${PREFIX_RULE}`])
  })

  it.each([['/api'], ['/api/v1'], [undefined]])('accepts the prefix %p', (prefix) => {
    expect(refusal({}, { prefix })).toEqual([])
  })

  it.each([[''], ['-tickets'], ['.tickets'], ['tickets list'], ['tickets/list'], ['__proto__x'], ['t'.repeat(65)]])(
    'refuses the route name %p',
    (name) => {
      expect(refusal({ [name]: route('GET', '/tickets', says('list')) })).toEqual(['Invalid routes:', `  - ${name}: ${NAME_RULE}`])
    }
  )

  it.each([['t'], ['7'], ['Tickets.list_all:v2-beta'], ['t'.repeat(64)]])('accepts the route name %p', (name) => {
    expect(refusal({ [name]: route('GET', '/tickets', says('list')) })).toEqual([])
  })

  it.each([[null], [undefined], ['GET /tickets'], [7], [[]], [says('bare handler')], [new Map()]])('refuses %p as a route', (value) => {
    expect(refusal({ tickets: value })).toEqual(['Invalid routes:', '  - tickets: not a route; build it with route().'])
  })

  it('accepts a route written as a plain object', () => {
    expect(refusal({ tickets: { method: 'GET', pattern: '/tickets', handler: says('list') } })).toEqual([])
  })

  it.each([['get'], ['TRACE'], ['CONNECT'], [undefined], [7], [Symbol('GET')]])('refuses the method %p', (method) => {
    expect(refusal({ tickets: route(method as Method, '/tickets', says('list')) })).toEqual([
      'Invalid routes:',
      `  - tickets: ${METHOD_RULE}`,
    ])
  })

  it.each([['GET'], ['HEAD'], ['POST'], ['PUT'], ['PATCH'], ['DELETE'], ['OPTIONS']])('accepts the method %p', (method) => {
    expect(refusal({ tickets: route(method as Method, '/tickets', says('list')) })).toEqual([])
  })

  it('reads the methods of the running Node.js for a QUERY route when it is given no runtime', () => {
    expect(refusal({ search: route('QUERY', '/tickets', says('search')) })).toEqual(
      METHODS.includes('QUERY') ? [] : ['Invalid routes:', `  - search: ${UNPARSED_QUERY}`]
    )
  })

  it.each([
    ['tickets', 'the pattern must start with "/".'],
    ['/tickets/', 'the pattern must not end with "/".'],
    ['/tickets//open', 'the pattern has an empty segment.'],
    ['/tickets/..', 'segment 2 can never match a canonical path.'],
    ['/tickets/:', 'segment 2 needs a name of letters, digits and "_", not starting with a digit.'],
    ['/:__proto__', 'segment 1 needs a name of letters, digits and "_", not starting with a digit.'],
    ['/:id/:id', 'the parameter "id" is declared twice.'],
    ['/*rest/raw', 'a wildcard must be the last segment.'],
  ])('refuses the pattern %p', (pattern, problem) => {
    expect(refusal({ tickets: route('GET', pattern, says('list')) })).toEqual(['Invalid routes:', `  - tickets: ${problem}`])
  })

  it.each([[0], [-1], [1.5], [2147483648], [Number.NaN], [Infinity], ['250'], [null]])('refuses a timeoutMs of %p', (timeoutMs) => {
    expect(refusal({ tickets: route('GET', '/tickets', says('list'), { timeoutMs: timeoutMs as number }) })).toEqual([
      'Invalid routes:',
      '  - tickets: "timeoutMs" must be a positive integer.',
    ])
  })

  it.each([[undefined], [null], ['handler'], [{}]])('refuses the handler %p', (handler) => {
    expect(refusal({ tickets: route('GET', '/tickets', handler as unknown as Handler) })).toEqual([
      'Invalid routes:',
      '  - tickets: the handler must be a function.',
    ])
  })

  it('finds two routes of one method ambiguous whatever they call their params', () => {
    expect(refusal({ second: route('GET', '/a/:x/*rest', says('second')), first: route('GET', '/a/:y/*tail', says('first')) })).toEqual([
      'Invalid routes:',
      '  - first and second: the same method and shape.',
    ])
  })

  it('names every later route of an ambiguous group against the first', () => {
    const table = { c: route('PUT', '/a', says('c')), a: route('PUT', '/a', says('a')), b: route('PUT', '/a', says('b')) }
    expect(refusal(table)).toEqual([
      'Invalid routes:',
      '  - a and b: the same method and shape.',
      '  - a and c: the same method and shape.',
    ])
  })

  it('does not find a GET and a HEAD of one shape ambiguous', () => {
    expect(refusal({ read: route('GET', '/a/:id', says('read')), probe: route('HEAD', '/a/:id', says('probe')) })).toEqual([])
  })

  it('does not find a param and a static segment named alike ambiguous', () => {
    expect(refusal({ any: route('GET', '/a/:param', says('any')), one: route('GET', '/a/param', says('one')) })).toEqual([])
  })

  it('leaves a route with a pattern problem out of the ambiguity check', () => {
    const table = { first: route('GET', '/a/', says('first')), second: route('GET', '/a/', says('second')) }
    expect(refusal(table)).toEqual([
      'Invalid routes:',
      '  - first: the pattern must not end with "/".',
      '  - second: the pattern must not end with "/".',
    ])
  })

  it('leaves a route with a method problem out of the ambiguity check', () => {
    const table = { first: route('get' as Method, '/a', says('first')), second: route('get' as Method, '/a', says('second')) }
    expect(refusal(table)).toEqual(['Invalid routes:', `  - first: ${METHOD_RULE}`, `  - second: ${METHOD_RULE}`])
  })

  it('still finds a route with a faulty handler ambiguous', () => {
    const table = { first: route('GET', '/a', says('first')), second: route('GET', '/a', null as unknown as Handler) }
    expect(refusal(table)).toEqual([
      'Invalid routes:',
      '  - second: the handler must be a function.',
      '  - first and second: the same method and shape.',
    ])
  })

  it('calls no handler while it builds', () => {
    const calls: string[] = []
    router({ tickets: route('GET', '/tickets', () => (calls.push('handler'), jsonResponse(200, 'list'))) })
    expect(calls).toEqual([])
  })
})

describe('router dispatch', () => {
  it('hands the handler the decoded params of its pattern', async () => {
    const step = router({
      files: route('GET', '/tickets/:id/files/*rest', (request) => jsonResponse(200, [request.params.id, request.params.rest])),
    })
    expect((await seen(step, 'GET', '/tickets/a b/files/x/y.txt')).body).toBe('["a b","x/y.txt"]')
  })

  it('hands the handler params that are frozen and have no prototype', async () => {
    const facts: unknown[] = []
    const step = router({
      read: route(
        'GET',
        '/tickets/:id',
        ({ params }) => (facts.push(Object.isFrozen(params), Object.getPrototypeOf(params)), jsonResponse(200, 1))
      ),
    })
    await seen(step, 'GET', '/tickets/7')
    expect(facts).toEqual([true, null])
  })

  it('hands the handler a frozen copy of the request with everything but the params unchanged', async () => {
    const incoming = requestFor('GET', '/tickets/7')
    const received: ServiceRequest[] = []
    const step = router({ read: route('GET', '/tickets/:id', (request) => (received.push(request), jsonResponse(200, 1))) })
    await step(incoming, createProbe().context, createDelegation().next)
    expect([Object.isFrozen(received[0]), { ...received[0] }]).toEqual([true, { ...incoming, params: { id: '7' } }])
  })

  it('does not mutate the incoming request', async () => {
    const incoming = requestFor('GET', '/tickets/7')
    await router({ read: route('GET', '/tickets/:id', says('read')) })(incoming, createProbe().context, createDelegation().next)
    expect({ ...incoming.params }).toEqual({})
  })

  it('returns what the handler returned, as the very object', () => {
    const response: ServiceResponse = { status: 204, headers: {}, body: null }
    const step = router({ ping: route('GET', '/ping', () => response) })
    expect(step(requestFor('GET', '/ping'), createProbe().context, createDelegation().next)).toBe(response)
  })

  it('throws what the handler threw', () => {
    const fault = new Error('the handler failed')
    const step = router({
      ping: route('GET', '/ping', () => {
        throw fault
      }),
    })
    expect(() => step(requestFor('GET', '/ping'), createProbe().context, createDelegation().next)).toThrow(fault)
  })

  it('passes the context on unchanged for a route without a deadline', async () => {
    const probe = createProbe()
    const received: unknown[] = []
    const step = router({ ping: route('GET', '/ping', (_request, context) => (received.push(context), jsonResponse(200, 1))) })
    await step(requestFor('GET', '/ping'), probe.context, createDelegation().next)
    expect(received[0]).toBe(probe.context)
  })

  it('annotates the route by its name in the table, and nothing else', async () => {
    const step = router({ 'tickets.read': route('GET', '/tickets/:id', says('read')) })
    expect((await seen(step, 'GET', '/tickets/7')).annotations).toEqual([['route', 'tickets.read']])
  })

  it('annotates the route before the handler runs', async () => {
    const probe = createProbe()
    const before: unknown[] = []
    const step = router({ read: route('GET', '/tickets/:id', () => (before.push(...probe.annotations), jsonResponse(200, 1))) })
    await step(requestFor('GET', '/tickets/7'), probe.context, createDelegation().next)
    expect(before).toEqual([['route', 'read']])
  })

  it('delegates once, adding nothing and annotating nothing, when no route knows the path', async () => {
    const step = router({ read: route('GET', '/tickets/:id', says('read')) })
    expect(await seen(step, 'GET', '/unknown')).toEqual({
      status: 404,
      allow: undefined,
      body: undefined,
      annotations: [],
      delegated: [[]],
    })
  })

  it('returns what next() gave it when it delegates', () => {
    const inner = Promise.resolve({ status: 200, headers: {}, body: null })
    const step = router({})
    expect(step(requestFor('GET', '/'), createProbe().context, () => inner)).toBe(inner)
  })

  it.each([['/tickets/7/'], ['/Tickets/7'], ['/tickets'], ['/tickets/'], ['/tickets/7/files']])(
    'delegates for %p, which no pattern matches',
    async (canonical) => {
      const step = router({ read: route('GET', '/tickets/:id', says('read')) })
      expect((await seen(step, 'GET', canonical)).delegated).toEqual([[]])
    }
  )

  it('answers the root pattern on the root path', async () => {
    expect((await seen(router({ home: route('GET', '/', says('home')) }), 'GET', '/')).body).toBe('"home"')
  })

  it('answers 405 with Allow when the path matches under another method only', async () => {
    const step = router({ create: route('POST', '/tickets', says('create')) })
    expect(await seen(step, 'GET', '/tickets')).toEqual({
      status: 405,
      allow: 'POST',
      body: 'Method Not Allowed',
      annotations: [
        ['route', 'create'],
        ['failure', 'method-not-allowed'],
      ],
      delegated: [],
    })
  })

  it('lists Allow in the fixed order, whatever the order of the table', async () => {
    const step = router({
      a: route('OPTIONS', '/t', says('a')),
      b: route('DELETE', '/t', says('b')),
      c: route('PATCH', '/t', says('c')),
      d: route('PUT', '/t', says('d')),
      e: route('POST', '/t', says('e')),
      f: route('HEAD', '/t', says('f')),
    })
    expect((await seen(step, 'GET', '/t')).allow).toBe('HEAD, POST, PUT, PATCH, DELETE, OPTIONS')
  })

  it('adds HEAD to Allow when a GET route matches', async () => {
    const step = router({ read: route('GET', '/tickets/:id', says('read')), remove: route('DELETE', '/tickets/:id', says('remove')) })
    expect((await seen(step, 'POST', '/tickets/7')).allow).toBe('GET, HEAD, DELETE')
  })

  it('lists a method once in Allow when several matching routes share it', async () => {
    const step = router({ one: route('GET', '/tickets/open', says('one')), any: route('GET', '/tickets/:id', says('any')) })
    expect((await seen(step, 'PUT', '/tickets/open')).allow).toBe('GET, HEAD')
  })

  it('annotates a 405 with the most specific route that knows the path, for both orders of the table', async () => {
    const specific = route('GET', '/tickets/open', says('specific'))
    const loose = route('DELETE', '/tickets/:id', says('loose'))
    const annotated = await Promise.all(
      [router({ aa: loose, zz: specific }), router({ aa: specific, zz: loose })].map(
        async (step) => (await seen(step, 'POST', '/tickets/open')).annotations
      )
    )
    expect(annotated).toEqual([
      [
        ['route', 'zz'],
        ['failure', 'method-not-allowed'],
      ],
      [
        ['route', 'aa'],
        ['failure', 'method-not-allowed'],
      ],
    ])
  })

  it('annotates a 405 with the name that sorts first when routes of one shape tie', async () => {
    const step = router({
      'tickets.replace': route('PUT', '/tickets/:id', says('replace')),
      'tickets.Remove': route('DELETE', '/tickets/:key', says('remove')),
      'tickets.read': route('GET', '/tickets/:ticket', says('read')),
    })
    expect((await seen(step, 'POST', '/tickets/7')).annotations).toEqual([
      ['route', 'tickets.Remove'],
      ['failure', 'method-not-allowed'],
    ])
  })

  it('lets HEAD ride a GET route, whose handler sees the method HEAD', async () => {
    const step = router({ read: route('GET', '/tickets/:id', (request) => jsonResponse(200, [request.method, request.params.id])) })
    expect(await seen(step, 'HEAD', '/tickets/7')).toEqual({
      status: 200,
      allow: undefined,
      body: '["HEAD","7"]',
      annotations: [['route', 'read']],
      delegated: [],
    })
  })

  it('prefers an explicit HEAD route to the GET route of the same shape', async () => {
    const step = router({ a: route('GET', '/tickets/:id', says('get')), b: route('HEAD', '/tickets/:id', says('head')) })
    expect((await seen(step, 'HEAD', '/tickets/7')).body).toBe('"head"')
  })

  it('prefers a less specific HEAD route to a more specific GET route', async () => {
    const step = router({ a: route('GET', '/tickets/open', says('get')), b: route('HEAD', '/tickets/:id', says('head')) })
    expect((await seen(step, 'HEAD', '/tickets/open')).body).toBe('"head"')
  })

  it('answers a HEAD request 405 when no GET and no HEAD route matches', async () => {
    const step = router({ create: route('POST', '/tickets', says('create')) })
    expect((await seen(step, 'HEAD', '/tickets')).allow).toBe('POST')
  })

  it('does not let a POST ride a GET route', async () => {
    expect((await seen(router({ read: route('GET', '/tickets', says('read')) }), 'POST', '/tickets')).status).toBe(405)
  })

  it('answers OPTIONS 405 without an OPTIONS route', async () => {
    const step = router({ read: route('GET', '/tickets', says('read')) })
    expect(await seen(step, 'OPTIONS', '/tickets')).toEqual({
      status: 405,
      allow: 'GET, HEAD',
      body: 'Method Not Allowed',
      annotations: [
        ['route', 'read'],
        ['failure', 'method-not-allowed'],
      ],
      delegated: [],
    })
  })

  it('dispatches an OPTIONS route', async () => {
    expect((await seen(router({ grant: route('OPTIONS', '/tickets', says('grant')) }), 'OPTIONS', '/tickets')).body).toBe('"grant"')
  })

  it('answers 405 for a method no route may name', async () => {
    expect((await seen(router({ read: route('GET', '/tickets', says('read')) }), 'PROPFIND', '/tickets')).allow).toBe('GET, HEAD')
  })

  it.each([
    ['/a/b', ['/a/b', '/a/:x', '/*all'], '/a/b'],
    ['/a/b', ['/a/:x', '/:y/b'], '/a/:x'],
    ['/a/b', ['/:y/b', '/:y/:z'], '/:y/b'],
    ['/a/b/c', ['/a/:x/c', '/a/*rest'], '/a/:x/c'],
    ['/a/b', ['/a/*rest', '/:x/b'], '/a/*rest'],
  ])('dispatches %p to the most specific of %j, for both orders of the table', async (canonical, patterns, winner) => {
    const forward = Object.fromEntries(patterns.map((pattern, index) => [`r${index}`, route('GET', pattern, says(pattern))]))
    const backward = Object.fromEntries(
      patterns.map((pattern, index) => [`r${patterns.length - index}`, route('GET', pattern, says(pattern))])
    )
    const bodies = await Promise.all([forward, backward].map(async (table) => (await seen(router(table), 'GET', canonical)).body))
    expect(bodies).toEqual([`"${winner}"`, `"${winner}"`])
  })

  it('dispatches a less specific route of the right method over a more specific one of another method', async () => {
    const step = router({ open: route('GET', '/tickets/open', says('open')), update: route('POST', '/tickets/:id', says('update')) })
    expect(await seen(step, 'POST', '/tickets/open')).toEqual({
      status: 200,
      allow: undefined,
      body: '"update"',
      annotations: [['route', 'update']],
      delegated: [],
    })
  })

  it('reads a param named like an inherited member from the path', async () => {
    const step = router({ read: route('GET', '/:constructor', (request) => jsonResponse(200, request.params.constructor)) })
    expect((await seen(step, 'GET', '/7')).body).toBe('"7"')
  })
})

describe('router prefix', () => {
  const table = {
    home: route('GET', '/', says('home')),
    read: route('GET', '/tickets/:id', (request) => jsonResponse(200, [request.params.id, request.path, request.url])),
  }

  it('puts the prefix in front of every pattern, and leaves the request as it came', async () => {
    expect((await seen(router(table, { prefix: '/api/v1' }), 'GET', '/api/v1/tickets/7')).body).toBe(
      '["7","/api/v1/tickets/7","/api/v1/tickets/7?page=2"]'
    )
  })

  it('makes the root pattern the prefix itself', async () => {
    expect((await seen(router(table, { prefix: '/api' }), 'GET', '/api')).body).toBe('"home"')
  })

  it.each([['/api/'], ['/'], ['/tickets/7'], ['/apix/tickets/7'], ['/v1/api/tickets/7']])(
    'delegates for %p, outside the prefix',
    async (canonical) => {
      expect((await seen(router(table, { prefix: '/api' }), 'GET', canonical)).delegated).toEqual([[]])
    }
  )

  it('answers 405 under the prefix as it does without one', async () => {
    expect((await seen(router(table, { prefix: '/api' }), 'DELETE', '/api/tickets/7')).allow).toBe('GET, HEAD')
  })
})

describe('routes that share a path', () => {
  const admit: Step = (_request, _context, next) => next()

  it('answers 405 from the first of two chained routers for a path it knows, and never asks the second', async () => {
    const open = router({ 'reports.list': route('GET', '/reports', says('list')) })
    const admin = router({ 'reports.create': route('POST', '/reports', says('create')) })
    expect(await seen(chain(open, admin), 'POST', '/reports')).toEqual({
      status: 405,
      allow: 'GET, HEAD',
      body: 'Method Not Allowed',
      annotations: [
        ['route', 'reports.list'],
        ['failure', 'method-not-allowed'],
      ],
      delegated: [],
    })
  })

  it('answers every method of a path from one table, a guard standing in front of the route a step must precede', async () => {
    const step = router({
      'reports.list': route('GET', '/reports', says('list')),
      'reports.create': route('POST', '/reports', guard(admit, says('create'))),
    })
    expect([(await seen(step, 'GET', '/reports')).body, (await seen(step, 'POST', '/reports')).body]).toEqual(['"list"', '"create"'])
  })

  it('lists every method of a path in Allow when one table holds them all', async () => {
    const step = router({
      'reports.list': route('GET', '/reports', says('list')),
      'reports.create': route('POST', '/reports', guard(admit, says('create'))),
    })
    expect((await seen(step, 'DELETE', '/reports')).allow).toBe('GET, HEAD, POST')
  })
})
