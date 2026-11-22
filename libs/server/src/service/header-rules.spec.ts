import type { ServeHeaderRule } from '../policy/serve-types'
import type { BaseContext, ServiceRequest, ServiceResponse, Step } from './contract'
import { Readable } from 'node:stream'
import { describe, expect, it } from '@hyperfrontend/testing'
import { headerRules } from './header-rules'
import { httpError } from './http-error'
import { runPipeline, settle } from './pipeline'

/** What a spec asserts on after one request went through the step. */
interface Seen {
  /** The response the boundary around the step resolved with. */
  readonly response: ServiceResponse
  /** The arguments of every call of `next`, in order. */
  readonly delegated: unknown[][]
}

/**
 * Builds a request the way the listener does: frozen, with a raw target and the canonical path decoded from it.
 *
 * @param canonical - What the listener decoded the target to.
 * @param raw - The target as the client sent it; the canonical path when omitted.
 * @returns The frozen request.
 */
const requestFor = (canonical: string, raw: string = canonical): ServiceRequest =>
  Object.freeze({
    method: 'GET',
    url: raw,
    headers: Object.freeze(Object.create(null)),
    path: canonical,
    query: Object.freeze({}),
    params: Object.freeze(Object.create(null)),
    body: Object.freeze({ length: null }),
  }) as unknown as ServiceRequest

/**
 * Builds a frozen response, so that a step which wrote to it would throw.
 *
 * @param headers - The headers the inner step answered with.
 * @returns A 200 response with a small body.
 */
const inner = (headers: Record<string, string> = {}): ServiceResponse =>
  Object.freeze({ status: 200, headers: Object.freeze(headers), body: Buffer.from('report') })

/**
 * Runs the step behind the boundary the listener puts around a pipeline and gathers what a spec asserts on.
 *
 * @param step - The step under test.
 * @param request - The request sent through it.
 * @param answer - What the rest of the pipeline does when the step delegates; a 200 with no headers when omitted.
 * @returns The response and the calls of `next`.
 */
const seen = async (step: Step, request: ServiceRequest, answer: () => ServiceResponse = inner): Promise<Seen> => {
  const delegated: unknown[][] = []
  const context: BaseContext = Object.freeze({
    signal: new AbortController().signal,
    client: Object.freeze({ address: '192.0.2.7' }),
    annotate: () => undefined,
    report: () => undefined,
  })
  const next = (...extra: unknown[]): Promise<ServiceResponse> => (delegated.push(extra), settle(answer, context))
  return { response: await settle(() => step(request, context, next), context), delegated }
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

const FRAMING: ServeHeaderRule = { headers: { 'X-Frame-Options': 'DENY' } }

// note: A rule that writes a lifetime for every path, the way a preset written for pages and assets does.
const CACHED: ServeHeaderRule = { headers: { 'Cache-Control': 'max-age=600' } }

const UNSTORED = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }

/**
 * Builds what the rest of a pipeline does when it answers with one response of its own.
 *
 * @param status - The status of the response.
 * @param headers - The headers of the response.
 * @returns A function that returns the frozen response.
 */
const answers =
  (status: number, headers: Record<string, string>): (() => ServiceResponse) =>
  () =>
    Object.freeze({ status, headers: Object.freeze(headers), body: Buffer.from('report') })

/**
 * Builds what the rest of a pipeline does when it fails.
 *
 * @param error - What is thrown.
 * @returns A function that throws it.
 */
const throws =
  (error: unknown): (() => never) =>
  () => {
    throw error
  }

describe('headerRules', () => {
  it('applies a matching rule to the response of the steps inside it', async () => {
    const { response } = await seen(headerRules([FRAMING]), requestFor('/reports/7'), () => inner({ 'Content-Type': 'application/json' }))
    expect(response).toEqual({
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Frame-Options': 'DENY' },
      body: Buffer.from('report'),
    })
  })

  it('runs the rest of the pipeline once, adding nothing to the context', async () => {
    expect((await seen(headerRules([FRAMING]), requestFor('/reports/7'))).delegated).toEqual([[]])
  })

  it('leaves the headers alone when no rule matches the path', async () => {
    const rules = [{ prefix: '/assets/', headers: { 'Cache-Control': 'immutable' } }]
    expect((await seen(headerRules(rules), requestFor('/reports/7'), () => inner({ ETag: '"a"' }))).response.headers).toEqual({
      ETag: '"a"',
    })
  })

  it('matches a suffix against the canonical path, which the query of the raw target would hide', async () => {
    const rules = [{ suffix: '.json', headers: { 'Cache-Control': 'no-cache' } }]
    const { response } = await seen(headerRules(rules), requestFor('/reports/7.json', '/reports/7.json?download=1'))
    expect(response.headers).toEqual({ 'Cache-Control': 'no-cache' })
  })

  it('matches a prefix against the canonical path, which an escape in the raw target would hide', async () => {
    const rules = [{ prefix: '/reports/', headers: { 'Cache-Control': 'no-cache' } }]
    const { response } = await seen(headerRules(rules), requestFor('/reports/7', '/%72eports/7'))
    expect(response.headers).toEqual({ 'Cache-Control': 'no-cache' })
  })

  it('does not match on the raw target', async () => {
    const rules = [{ prefix: '/%72eports/', headers: { 'Cache-Control': 'no-cache' } }]
    const { response } = await seen(headerRules(rules), requestFor('/reports/7', '/%72eports/7'))
    expect(response.headers).toEqual({})
  })

  it('marks a failure rendered inside it like a success', async () => {
    const refuse = (): never => {
      throw httpError(404, 'not-found')
    }
    const { response } = await seen(headerRules([FRAMING]), requestFor('/reports/7'), refuse)
    expect({ status: response.status, headers: response.headers }).toEqual({
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' },
    })
  })

  it('marks a fault inside it like a success', async () => {
    const fail = (): never => {
      throw new Error('down')
    }
    const { response } = await seen(headerRules([FRAMING]), requestFor('/reports/7'), fail)
    expect({ status: response.status, framing: response.headers['X-Frame-Options'] }).toEqual({ status: 500, framing: 'DENY' })
  })

  it('lets a later rule win one header at a time', async () => {
    const rules = [
      { headers: { 'Cache-Control': 'no-cache', 'X-Frame-Options': 'DENY' } },
      { prefix: '/reports/', headers: { 'Cache-Control': 'private' } },
    ]
    expect((await seen(headerRules(rules), requestFor('/reports/7'))).response.headers).toEqual({
      'Cache-Control': 'private',
      'X-Frame-Options': 'DENY',
    })
  })

  it('replaces a header the response carried under another spelling', async () => {
    const rules = [{ headers: { 'Cache-Control': 'private' } }]
    const { response } = await seen(headerRules(rules), requestFor('/reports/7'), () => inner({ 'cache-control': 'public' }))
    expect(response.headers).toEqual({ 'Cache-Control': 'private' })
  })

  it.each([
    ['Content-Length', '6'],
    ['content-encoding', 'identity'],
    ['ETag', '"a"'],
  ])('never overrides %s, which describes the body', async (name, own) => {
    const { response } = await seen(headerRules([{ headers: { [name]: '7' } }]), requestFor('/reports/7'), () => inner({ [name]: own }))
    expect(response.headers).toEqual({ [name]: own })
  })

  it.each([
    ['Connection', 'close'],
    ['connection', 'keep-alive'],
    ['Keep-Alive', 'timeout=5'],
    ['Upgrade', 'h2c'],
    ['TE', 'trailers'],
    ['Transfer-Encoding', 'chunked'],
    ['Trailer', 'X-Checksum'],
  ])('leaves %s out of the response, which the boundary would refuse with it', async (name, value) => {
    const { response } = await seen(headerRules([{ headers: { [name]: value, 'X-Frame-Options': 'DENY' } }]), requestFor('/reports/7'))
    expect(response).toEqual({ status: 200, headers: { 'X-Frame-Options': 'DENY' }, body: Buffer.from('report') })
  })

  it.each([['Connection'], ['Keep-Alive'], ['Upgrade'], ['TE']])(
    'leaves %s out of a failure rendered inside it, which keeps its own status',
    async (name) => {
      const step = headerRules([{ headers: { [name]: 'close', 'X-Frame-Options': 'DENY' } }])
      const { response } = await seen(step, requestFor('/reports/7'), throws(httpError(404, 'not-found')))
      expect({ status: response.status, headers: response.headers }).toEqual({
        status: 404,
        headers: { ...UNSTORED, 'X-Frame-Options': 'DENY' },
      })
    }
  )

  it('passes the status, the cookies and a stream body through untouched', async () => {
    const body = Readable.from(['report'])
    const cookies = Object.freeze(['session=1; HttpOnly'])
    const { response } = await seen(headerRules([FRAMING]), requestFor('/reports/7'), () =>
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
    const { response } = await seen(headerRules([FRAMING]), requestFor('/reports/7'), () => given)
    expect([response === given, given.headers]).toEqual([false, { 'Content-Type': 'text/plain' }])
  })

  it('returns the headers of the response unchanged when there are no rules', async () => {
    const { response } = await seen(headerRules([]), requestFor('/reports/7'), () =>
      inner({ 'Content-Type': 'text/plain', vary: 'Origin' })
    )
    expect(Object.entries(response.headers)).toEqual([
      ['Content-Type', 'text/plain'],
      ['vary', 'Origin'],
    ])
  })

  it('refuses at construction a rule the validator of the policy entry refuses, naming its place', () => {
    const rules = [FRAMING, { headers: { 'X-Note': 5 } }]
    expect(thrownBy(() => headerRules(rules as never))).toEqual(new Error('headerRules: headers[1].headers["X-Note"] must be a string.'))
  })

  it('refuses a rule whose header value would end the head early', () => {
    const rules = [{ headers: { 'X-Note': 'ok\r\nSet-Cookie: a=b' } }]
    expect(thrownBy(() => headerRules(rules))).toEqual(
      new Error('headerRules: headers[0].headers["X-Note"] must not contain control characters.')
    )
  })

  it('refuses a rule with a field it does not take', () => {
    const rules = [{ headers: {}, path: '/reports/' }]
    expect(thrownBy(() => headerRules(rules as never))).toEqual(
      new Error('headerRules: headers[0] has an unknown field "path": a rule takes prefix, suffix and headers.')
    )
  })

  it('refuses a hole in the rules', () => {
    const rules: ServeHeaderRule[] = [FRAMING]
    rules[2] = FRAMING
    expect(thrownBy(() => headerRules(rules))).toEqual(new Error('headerRules: headers[1] must be an object.'))
  })

  it('reads its rules once, so a rule added later is never applied', async () => {
    const rules: ServeHeaderRule[] = [FRAMING]
    const step = headerRules(rules)
    rules.push({ headers: { 'Cache-Control': 'private' } })
    expect((await seen(step, requestFor('/reports/7'))).response.headers).toEqual({ 'X-Frame-Options': 'DENY' })
  })
})

describe('headerRules on a failure nothing may store', () => {
  it('keeps the no-store of a thrown failure under a rule that writes a lifetime for every path', async () => {
    const { response } = await seen(headerRules([CACHED]), requestFor('/reports/7'), throws(httpError(403, 'forbidden')))
    expect({ status: response.status, headers: response.headers }).toEqual({ status: 403, headers: UNSTORED })
  })

  it('keeps the no-store of the 404 past the end of the pipeline', async () => {
    const context: BaseContext = Object.freeze({
      signal: new AbortController().signal,
      client: Object.freeze({ address: '192.0.2.7' }),
      annotate: () => undefined,
      report: () => undefined,
    })
    const response = await settle(() => runPipeline([headerRules([CACHED])], requestFor('/nothing'), context), context)
    expect({ status: response.status, headers: response.headers }).toEqual({ status: 404, headers: UNSTORED })
  })

  it('keeps the no-store of the 500 for an unexpected throw', async () => {
    const { response } = await seen(headerRules([CACHED]), requestFor('/reports/7'), throws(new Error('down')))
    expect({ status: response.status, headers: response.headers }).toEqual({ status: 500, headers: UNSTORED })
  })

  it.each([['Expires'], ['Surrogate-Control'], ['X-Accel-Expires'], ['CDN-Cache-Control'], ['cloudflare-cdn-cache-control']])(
    'sends a rendered failure no %s a rule wrote',
    async (name) => {
      const rules = [{ headers: { [name]: 'max-age=600' } }]
      expect((await seen(headerRules(rules), requestFor('/reports/7'), throws(httpError(404, 'not-found')))).response.headers).toEqual(
        UNSTORED
      )
    }
  )

  it('sends a rendered failure every other header of the rule that wrote a lifetime', async () => {
    const rules = [
      { headers: { 'Cache-Control': 'max-age=600', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'" } },
    ]
    expect((await seen(headerRules(rules), requestFor('/reports/7'), throws(new Error('down')))).response.headers).toEqual({
      ...UNSTORED,
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'",
    })
  })

  it('leaves the headers a failure carries itself, a lifetime of its own included', async () => {
    const busy = httpError(503, 'busy', { 'Retry-After': '5', 'CDN-Cache-Control': 'max-age=5' })
    expect((await seen(headerRules([CACHED]), requestFor('/reports/7'), throws(busy))).response.headers).toEqual({
      ...UNSTORED,
      'Retry-After': '5',
      'CDN-Cache-Control': 'max-age=5',
    })
  })

  it.each([[400], [404], [503], [599]])('keeps the no-store of a %d a handler returned itself', async (status) => {
    const { response } = await seen(headerRules([CACHED]), requestFor('/reports/7'), answers(status, { 'Cache-Control': 'no-store' }))
    expect(response.headers).toEqual({ 'Cache-Control': 'no-store' })
  })

  it('recognises the header under another spelling of its name, and sends it under one', async () => {
    const { response } = await seen(headerRules([CACHED]), requestFor('/reports/7'), answers(500, { 'cache-control': 'no-store' }))
    expect(response.headers).toEqual({ 'Cache-Control': 'no-store' })
  })

  it.each([[200], [204], [304], [399]])('lets a rule replace the no-store of a %d, which is no failure', async (status) => {
    const { response } = await seen(headerRules([CACHED]), requestFor('/reports/7'), answers(status, { 'Cache-Control': 'no-store' }))
    expect(response.headers).toEqual({ 'Cache-Control': 'max-age=600' })
  })

  it('lets a rule write the Cache-Control of a failure that carries none', async () => {
    const { response } = await seen(headerRules([CACHED]), requestFor('/reports/7'), answers(404, { 'Content-Type': 'text/html' }))
    expect(response.headers).toEqual({ 'Content-Type': 'text/html', 'Cache-Control': 'max-age=600' })
  })

  it('lets a rule replace the Cache-Control of a failure whose error chose a lifetime of its own', async () => {
    const gone = httpError(410, 'gone', { 'Cache-Control': 'max-age=60' })
    expect((await seen(headerRules([CACHED]), requestFor('/reports/7'), throws(gone))).response.headers).toEqual({
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'max-age=600',
    })
  })

  it('lets a rule replace a Cache-Control that says more than no-store, which the kernel never writes', async () => {
    const own = answers(500, { 'Cache-Control': 'private, no-store' })
    expect((await seen(headerRules([CACHED]), requestFor('/reports/7'), own)).response.headers).toEqual({ 'Cache-Control': 'max-age=600' })
  })

  it('leaves a failure nothing may store as it was when there are no rules', async () => {
    const { response } = await seen(headerRules([]), requestFor('/reports/7'), throws(httpError(404, 'not-found')))
    expect(Object.entries(response.headers)).toEqual([
      ['Content-Type', 'text/plain; charset=utf-8'],
      ['Cache-Control', 'no-store'],
    ])
  })
})
