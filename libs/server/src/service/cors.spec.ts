import type { BaseContext, ServiceRequest, ServiceResponse, Step } from './contract'
import type { CorsOptions } from './cors'
import { Readable } from 'node:stream'
import { describe, expect, it } from '@hyperfrontend/testing'
import { cors } from './cors'
import { httpError } from './http-error'
import { settle } from './pipeline'

/** What a spec asserts on after one request went through the step. */
interface Seen {
  /** The response the boundary around the step resolved with. */
  readonly response: ServiceResponse
  /** The headers of the response as ordered pairs. */
  readonly headers: [string, string][]
  /** The arguments of every call of `next`, in order. */
  readonly delegated: unknown[][]
  /** Every `annotate` call, in order. */
  readonly annotations: unknown[][]
}

const SITE = 'https://site.example'
const OTHER = 'https://other.example'

/**
 * Builds a request the way the listener does: frozen, with lower-cased headers in an object without a prototype.
 *
 * @param method - GET, OPTIONS and so on, as Node hands it over.
 * @param headers - The request headers, names in lower case.
 * @returns The frozen request.
 */
const requestFor = (method: string, headers: Record<string, string> = {}): ServiceRequest =>
  Object.freeze({
    method,
    url: '/tickets?page=2',
    headers: Object.freeze(Object.assign(Object.create(null), headers)),
    path: '/tickets',
    query: Object.freeze({}),
    params: Object.freeze(Object.create(null)),
    body: Object.freeze({ length: null }),
  }) as unknown as ServiceRequest

/**
 * Builds a preflight request from an origin.
 *
 * @param origin - What the `Origin` header says.
 * @returns An `OPTIONS` request that asks to send a `PUT`.
 */
const preflightFrom = (origin: string): ServiceRequest => requestFor('OPTIONS', { origin, 'access-control-request-method': 'PUT' })

/**
 * Builds a frozen response, so that a step which wrote to it would throw.
 *
 * @param headers - The headers the inner step answered with.
 * @returns A 200 response with a small body.
 */
const inner = (headers: Record<string, string> = {}): ServiceResponse =>
  Object.freeze({ status: 200, headers: Object.freeze(headers), body: Buffer.from('tickets') })

/**
 * Runs the step behind the boundary the listener puts around a pipeline and gathers what a spec asserts on.
 *
 * @param step - The step under test.
 * @param request - The request sent through it.
 * @param answer - What the rest of the pipeline does when the step delegates; a 200 with no headers when omitted.
 * @returns The response, its headers in order, the calls of `next` and the annotations.
 */
const seen = async (step: Step, request: ServiceRequest, answer: () => ServiceResponse = inner): Promise<Seen> => {
  const annotations: unknown[][] = []
  const delegated: unknown[][] = []
  const context: BaseContext = Object.freeze({
    signal: new AbortController().signal,
    client: Object.freeze({ address: '192.0.2.7' }),
    annotate: (name: string, value: string | number | boolean) => void annotations.push([name, value]),
    report: () => undefined,
  })
  const next = (...extra: unknown[]): Promise<ServiceResponse> => (delegated.push(extra), settle(answer, context))
  const response = await settle(() => step(request, context, next), context)
  return { response, headers: Object.entries(response.headers), delegated, annotations }
}

/**
 * Calls a function and returns what it threw.
 *
 * @param run - The function expected to throw.
 * @returns The thrown value, or `undefined` when nothing was thrown.
 */
const thrownBy = (run: () => unknown): unknown => {
  try {
    run()
  } catch (error) {
    return error
  }
  return undefined
}

/**
 * Builds the error a faulty set of options is refused with.
 *
 * @param lines - The problem lines, without their bullets.
 * @returns The error `cors` throws.
 */
const refusal = (...lines: string[]): Error => new Error(['Invalid cors options:', ...lines.map((line) => `  - ${line}`)].join('\n'))

const ORIGIN_LINE = 'must be a serialised origin such as "https://site.example".'
const METHOD_LINE = 'must be one of GET, HEAD, POST, PUT, PATCH, DELETE, QUERY, OPTIONS.'

describe('cors construction', () => {
  it('names every problem in one error, in a fixed order', () => {
    const options = {
      origins: [SITE, `${SITE}/`, 'site.example', 5],
      methods: ['GET', 'get', 'TRACE'],
      headers: ['Content-Type', 'bad header', ''],
      maxAgeSeconds: -1,
      credentials: 'yes',
    }
    expect(thrownBy(() => cors(options as never))).toEqual(
      refusal(
        `"origins[1]" ${ORIGIN_LINE}`,
        `"origins[2]" ${ORIGIN_LINE}`,
        `"origins[3]" ${ORIGIN_LINE}`,
        `"methods[1]" ${METHOD_LINE}`,
        `"methods[2]" ${METHOD_LINE}`,
        '"headers[1]" must be a header name.',
        '"headers[2]" must be a header name.',
        '"maxAgeSeconds" must be an integer between 0 and 86400.',
        '"credentials" must be a boolean.'
      )
    )
  })

  it.each([
    ['an empty array', []],
    ['a string', SITE],
    ['a set', new Set([SITE])],
    ['null', null],
    ['nothing', undefined],
  ])('refuses origins given as %s', (_label, origins) => {
    expect(thrownBy(() => cors({ origins } as never))).toEqual(refusal('"origins" must be a non-empty array.'))
  })

  it.each([
    ['a trailing slash', `${SITE}/`],
    ['a path', `${SITE}/app`],
    ['an upper-case scheme', 'HTTPS://site.example'],
    ['an upper-case host', 'https://Site.Example'],
    ['a default port', `${SITE}:443`],
    ['credentials', 'https://user@site.example'],
    ['no scheme', 'site.example'],
    ['a wildcard', '*'],
    ['the word null', 'null'],
    ['a scheme without an origin', 'file:///srv/site'],
    ['a blob address', `blob:${SITE}/0d6f`],
    ['a number', 443],
    ['nothing in its place', undefined],
  ])('refuses an origin with %s', (_label, origin) => {
    expect(thrownBy(() => cors({ origins: [origin as string] }))).toEqual(refusal(`"origins[0]" ${ORIGIN_LINE}`))
  })

  it('refuses a hole in the origins', () => {
    const origins: string[] = [SITE]
    origins[2] = OTHER
    expect(thrownBy(() => cors({ origins }))).toEqual(refusal(`"origins[1]" ${ORIGIN_LINE}`))
  })

  it('refuses a hole in the methods', () => {
    const methods: 'GET'[] = ['GET']
    methods[2] = 'GET'
    expect(thrownBy(() => cors({ origins: [SITE], methods }))).toEqual(refusal(`"methods[1]" ${METHOD_LINE}`))
  })

  it.each([[SITE], ['http://localhost:3000'], [`${SITE}:8443`], ['http://127.0.0.1']])('accepts the origin %j', (origin) => {
    expect(thrownBy(() => cors({ origins: [origin] }))).toBeUndefined()
  })

  it.each([
    ['a string', 'GET'],
    ['null', null],
    ['an object', { GET: true }],
  ])('refuses methods given as %s', (_label, methods) => {
    expect(thrownBy(() => cors({ origins: [SITE], methods } as never))).toEqual(refusal('"methods" must be an array.'))
  })

  it.each([['get'], ['TRACE'], ['CONNECT'], [''], [7]])('refuses the method %j', (method) => {
    expect(thrownBy(() => cors({ origins: [SITE], methods: [method] as never }))).toEqual(refusal(`"methods[0]" ${METHOD_LINE}`))
  })

  it('accepts every method a route may name', () => {
    const methods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'QUERY', 'OPTIONS'] as const
    expect(thrownBy(() => cors({ origins: [SITE], methods }))).toBeUndefined()
  })

  it('accepts QUERY among the methods', () => {
    expect(thrownBy(() => cors({ origins: [SITE], methods: ['QUERY'] }))).toBeUndefined()
  })

  it('refuses query in lower case, naming QUERY among the methods it accepts', () => {
    expect(thrownBy(() => cors({ origins: [SITE], methods: ['query'] as never }))).toEqual(refusal(`"methods[0]" ${METHOD_LINE}`))
  })

  it.each([
    ['a string', 'Content-Type'],
    ['null', null],
  ])('refuses headers given as %s', (_label, headers) => {
    expect(thrownBy(() => cors({ origins: [SITE], headers } as never))).toEqual(refusal('"headers" must be an array.'))
  })

  it.each([['bad header'], [''], ['X-Note:'], ['X-N\u00f6te'], [7]])('refuses the header name %j', (name) => {
    expect(thrownBy(() => cors({ origins: [SITE], headers: [name] as never }))).toEqual(refusal('"headers[0]" must be a header name.'))
  })

  it.each([[-1], [86401], [1.5], ['600'], [Number.NaN], [null]])('refuses the maxAgeSeconds %j', (maxAgeSeconds) => {
    expect(thrownBy(() => cors({ origins: [SITE], maxAgeSeconds } as never))).toEqual(
      refusal('"maxAgeSeconds" must be an integer between 0 and 86400.')
    )
  })

  it.each([[0], [86400]])('accepts the maxAgeSeconds %j', (maxAgeSeconds) => {
    expect(thrownBy(() => cors({ origins: [SITE], maxAgeSeconds }))).toBeUndefined()
  })

  it.each([['true'], [1], [null]])('refuses the credentials %j', (credentials) => {
    expect(thrownBy(() => cors({ origins: [SITE], credentials } as never))).toEqual(refusal('"credentials" must be a boolean.'))
  })

  it('quotes nothing of a faulty origin in its error', () => {
    expect(String(thrownBy(() => cors({ origins: ['https://secret-marker.example/'] })))).not.toContain('secret-marker')
  })
})

describe('cors preflight', () => {
  it('answers a listed origin 204 with the default grant, in a fixed order', async () => {
    const { response, headers } = await seen(cors({ origins: [SITE] }), preflightFrom(SITE))
    expect({ status: response.status, body: response.body, headers }).toEqual({
      status: 204,
      body: null,
      headers: [
        ['Access-Control-Allow-Origin', SITE],
        ['Access-Control-Allow-Methods', 'GET, HEAD'],
        ['Access-Control-Max-Age', '600'],
        ['Vary', 'Origin'],
      ],
    })
  })

  it('answers with every option that was given', async () => {
    const options: CorsOptions = {
      origins: [OTHER, SITE],
      methods: ['GET', 'PUT', 'DELETE'],
      headers: ['Content-Type', 'Authorization'],
      maxAgeSeconds: 30,
      credentials: true,
    }
    expect((await seen(cors(options), preflightFrom(SITE))).headers).toEqual([
      ['Access-Control-Allow-Origin', SITE],
      ['Access-Control-Allow-Methods', 'GET, PUT, DELETE'],
      ['Access-Control-Allow-Headers', 'Content-Type, Authorization'],
      ['Access-Control-Max-Age', '30'],
      ['Access-Control-Allow-Credentials', 'true'],
      ['Vary', 'Origin'],
    ])
  })

  it('grants QUERY to a preflight that asks for it when the method is listed', async () => {
    const asking = requestFor('OPTIONS', { origin: SITE, 'access-control-request-method': 'QUERY' })
    const { response } = await seen(cors({ origins: [SITE], methods: ['GET', 'QUERY'] }), asking)
    expect([response.status, response.headers['Access-Control-Allow-Methods']]).toEqual([204, 'GET, QUERY'])
  })

  it('leaves QUERY out of the grant of a preflight that asks for it when the method is not listed', async () => {
    const asking = requestFor('OPTIONS', { origin: SITE, 'access-control-request-method': 'QUERY' })
    const { response } = await seen(cors({ origins: [SITE] }), asking)
    expect(response.headers['Access-Control-Allow-Methods']).toBe('GET, HEAD')
  })

  it('sends no allow-headers line for an empty list', async () => {
    const { response } = await seen(cors({ origins: [SITE], headers: [] }), preflightFrom(SITE))
    expect(Object.keys(response.headers)).not.toContain('Access-Control-Allow-Headers')
  })

  it('sends no credentials line when credentials are declined', async () => {
    const { response } = await seen(cors({ origins: [SITE], credentials: false }), preflightFrom(SITE))
    expect(Object.keys(response.headers)).not.toContain('Access-Control-Allow-Credentials')
  })

  it('tells a browser not to cache with a max age of 0', async () => {
    const { response } = await seen(cors({ origins: [SITE], maxAgeSeconds: 0 }), preflightFrom(SITE))
    expect(response.headers['Access-Control-Max-Age']).toBe('0')
  })

  it('does not run the rest of the pipeline for a listed origin', async () => {
    expect((await seen(cors({ origins: [SITE] }), preflightFrom(SITE))).delegated).toEqual([])
  })

  it('annotates nothing for a granted preflight', async () => {
    expect((await seen(cors({ origins: [SITE] }), preflightFrom(SITE))).annotations).toEqual([])
  })

  it('refuses an unlisted origin with 403, varying on the origin and granting nothing', async () => {
    const { response, headers, annotations } = await seen(cors({ origins: [SITE], credentials: true }), preflightFrom(OTHER))
    expect({ status: response.status, headers, annotations }).toEqual({
      status: 403,
      headers: [
        ['Content-Type', 'text/plain; charset=utf-8'],
        ['Cache-Control', 'no-store'],
        ['Vary', 'Origin'],
      ],
      annotations: [['failure', 'origin-not-allowed']],
    })
  })

  it('throws the refusal as a failure a step may catch', () => {
    const step = cors({ origins: [SITE] })
    const thrown = thrownBy(() => step(preflightFrom(OTHER), {} as BaseContext, () => Promise.reject(new Error('delegated'))))
    expect(thrown).toMatchObject({ name: 'HttpError', status: 403, code: 'origin-not-allowed', headers: { Vary: 'Origin' } })
  })

  it('does not run the rest of the pipeline for an unlisted origin', async () => {
    expect((await seen(cors({ origins: [SITE] }), preflightFrom(OTHER))).delegated).toEqual([])
  })

  it.each([
    ['another letter case', 'https://SITE.example'],
    ['an explicit default port', `${SITE}:443`],
    ['a trailing slash', `${SITE}/`],
    ['a listed origin among two', `${SITE}, ${OTHER}`],
    ['nothing in it', ''],
  ])('refuses an origin with %s, since origins compare as exact strings', async (_label, origin) => {
    expect((await seen(cors({ origins: [SITE, OTHER] }), preflightFrom(origin))).response.status).toBe(403)
  })

  it('treats an OPTIONS request without Access-Control-Request-Method as any other request', async () => {
    const { response, delegated } = await seen(cors({ origins: [SITE] }), requestFor('OPTIONS', { origin: SITE }))
    expect({ status: response.status, delegated }).toEqual({ status: 200, delegated: [[]] })
  })

  it('treats an OPTIONS request without an origin as any other request', async () => {
    const { response, delegated } = await seen(cors({ origins: [SITE] }), requestFor('OPTIONS', { 'access-control-request-method': 'PUT' }))
    expect({ status: response.status, delegated }).toEqual({ status: 200, delegated: [[]] })
  })

  it('treats another method that carries both headers as any other request', async () => {
    const request = requestFor('POST', { origin: OTHER, 'access-control-request-method': 'PUT' })
    expect((await seen(cors({ origins: [SITE] }), request)).response.status).toBe(200)
  })

  it('reads its options once, so an origin added later is not granted', async () => {
    const origins = [SITE]
    const step = cors({ origins })
    origins.push(OTHER)
    expect((await seen(step, preflightFrom(OTHER))).response.status).toBe(403)
  })
})

describe('cors on other requests', () => {
  it('grants a listed origin and varies on the origin, after the headers the response had', async () => {
    const { headers } = await seen(cors({ origins: [SITE] }), requestFor('GET', { origin: SITE }), () =>
      inner({ 'Content-Type': 'text/plain' })
    )
    expect(headers).toEqual([
      ['Content-Type', 'text/plain'],
      ['Access-Control-Allow-Origin', SITE],
      ['Vary', 'Origin'],
    ])
  })

  it('gives an unlisted origin nothing but the Vary header', async () => {
    const { headers } = await seen(cors({ origins: [SITE], credentials: true }), requestFor('GET', { origin: OTHER }))
    expect(headers).toEqual([['Vary', 'Origin']])
  })

  it('gives a request without an origin nothing but the Vary header', async () => {
    const { headers } = await seen(cors({ origins: [SITE], credentials: true }), requestFor('GET'))
    expect(headers).toEqual([['Vary', 'Origin']])
  })

  it('grants credentials to a listed origin when they are allowed', async () => {
    const { headers } = await seen(cors({ origins: [SITE], credentials: true }), requestFor('POST', { origin: SITE }))
    expect(headers).toEqual([
      ['Access-Control-Allow-Origin', SITE],
      ['Access-Control-Allow-Credentials', 'true'],
      ['Vary', 'Origin'],
    ])
  })

  it('runs the rest of the pipeline once, adding nothing to the context', async () => {
    expect((await seen(cors({ origins: [SITE] }), requestFor('GET', { origin: SITE }))).delegated).toEqual([[]])
  })

  it('marks a failure rendered inside it like a success', async () => {
    const refuse = (): never => {
      throw httpError(401, 'unauthenticated', { 'WWW-Authenticate': 'Bearer' })
    }
    const { response, headers } = await seen(cors({ origins: [SITE] }), requestFor('GET', { origin: SITE }), refuse)
    expect({ status: response.status, headers }).toEqual({
      status: 401,
      headers: [
        ['Content-Type', 'text/plain; charset=utf-8'],
        ['Cache-Control', 'no-store'],
        ['WWW-Authenticate', 'Bearer'],
        ['Access-Control-Allow-Origin', SITE],
        ['Vary', 'Origin'],
      ],
    })
  })

  it('marks a fault inside it like a success', async () => {
    const fail = (): never => {
      throw new Error('down')
    }
    const { response } = await seen(cors({ origins: [SITE] }), requestFor('GET', { origin: SITE }), fail)
    expect({ status: response.status, grant: response.headers['Access-Control-Allow-Origin'] }).toEqual({ status: 500, grant: SITE })
  })

  it('leaves the no-store of a fault it marks, for a listed origin with credentials', async () => {
    const fail = (): never => {
      throw new Error('down')
    }
    const { headers } = await seen(cors({ origins: [SITE], credentials: true }), requestFor('GET', { origin: SITE }), fail)
    expect(headers).toEqual([
      ['Content-Type', 'text/plain; charset=utf-8'],
      ['Cache-Control', 'no-store'],
      ['Access-Control-Allow-Origin', SITE],
      ['Access-Control-Allow-Credentials', 'true'],
      ['Vary', 'Origin'],
    ])
  })

  it('leaves the no-store of a failure it marks for an unlisted origin', async () => {
    const refuse = (): never => {
      throw httpError(404, 'not-found')
    }
    const { headers } = await seen(cors({ origins: [SITE] }), requestFor('GET', { origin: OTHER }), refuse)
    expect(headers).toEqual([
      ['Content-Type', 'text/plain; charset=utf-8'],
      ['Cache-Control', 'no-store'],
      ['Vary', 'Origin'],
    ])
  })

  it('leaves a cache header the response carried under any spelling', async () => {
    const { headers } = await seen(cors({ origins: [SITE], credentials: true }), requestFor('GET', { origin: SITE }), () =>
      inner({ 'cache-control': 'no-store', Expires: '0' })
    )
    expect(headers).toEqual([
      ['cache-control', 'no-store'],
      ['Expires', '0'],
      ['Access-Control-Allow-Origin', SITE],
      ['Access-Control-Allow-Credentials', 'true'],
      ['Vary', 'Origin'],
    ])
  })

  it('replaces a grant the response already carried under another spelling', async () => {
    const { headers } = await seen(cors({ origins: [SITE] }), requestFor('GET', { origin: SITE }), () =>
      inner({ 'access-control-allow-origin': '*', 'access-control-allow-credentials': 'false' })
    )
    expect(headers).toEqual([
      ['access-control-allow-credentials', 'false'],
      ['Access-Control-Allow-Origin', SITE],
      ['Vary', 'Origin'],
    ])
  })

  it('appends to a Vary header the response already carried, keeping the spelling of its name', async () => {
    const { headers } = await seen(cors({ origins: [SITE] }), requestFor('GET'), () => inner({ vary: 'Accept-Encoding' }))
    expect(headers).toEqual([['vary', 'Accept-Encoding, Origin']])
  })

  it('leaves a Vary header that is a wildcard', async () => {
    const { headers } = await seen(cors({ origins: [SITE] }), requestFor('GET'), () => inner({ Vary: '*' }))
    expect(headers).toEqual([['Vary', '*']])
  })

  it('leaves a Vary header that already lists the origin in another case', async () => {
    const { headers } = await seen(cors({ origins: [SITE] }), requestFor('GET'), () => inner({ Vary: 'Accept-Encoding, origin' }))
    expect(headers).toEqual([['Vary', 'Accept-Encoding, origin']])
  })

  it('passes the status, the cookies and a stream body through untouched', async () => {
    const body = Readable.from(['tickets'])
    const cookies = Object.freeze(['session=1; HttpOnly'])
    const { response } = await seen(cors({ origins: [SITE] }), requestFor('GET', { origin: SITE }), () =>
      Object.freeze({ status: 201, headers: Object.freeze({}), cookies, body })
    )
    body.destroy()
    expect({ status: response.status, sameCookies: response.cookies === cookies, sameBody: response.body === body }).toEqual({
      status: 201,
      sameCookies: true,
      sameBody: true,
    })
  })

  it('answers with a new response and leaves the one it was given as it was', async () => {
    const given = inner({ 'Content-Type': 'text/plain' })
    const { response } = await seen(cors({ origins: [SITE] }), requestFor('GET', { origin: SITE }), () => given)
    expect([response === given, given.headers]).toEqual([false, { 'Content-Type': 'text/plain' }])
  })
})
