import type { BaseContext, ServiceRequest, ServiceResponse, Step } from './contract'
import { Readable } from 'node:stream'
import { createDeferred, describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { httpError } from './http-error'
import { runPipeline, settle } from './pipeline'

const BRAND = Symbol.for('@hyperfrontend/server/http-error')

/** A context that records what the boundary writes to it. */
interface Probe {
  /** The context handed to the pipeline. */
  readonly context: BaseContext
  /** Every `annotate` call, in order. */
  readonly annotations: unknown[][]
  /** Every `report` call, in order, the error described as text. */
  readonly reports: unknown[][]
  /** Aborts the context's signal. */
  abort(): void
}

/**
 * Describes a reported value as text an assertion can read.
 *
 * @param value - What was reported or thrown.
 * @returns `Name: message` for an error, else the value itself.
 */
const described = (value: unknown): unknown => (value instanceof Error ? `${value.name}: ${value.message}` : value)

/**
 * Builds a frozen context whose `annotate` and `report` record their calls.
 *
 * @returns The context and what it recorded.
 */
const createProbe = (): Probe => {
  const controller = new AbortController()
  const annotations: unknown[][] = []
  const reports: unknown[][] = []
  return {
    context: Object.freeze({
      signal: controller.signal,
      client: Object.freeze({ address: '192.0.2.7' }),
      annotate: (name: string, value: string | number | boolean) => void annotations.push([name, value]),
      report: (code: string, error: unknown) => void reports.push([code, described(error)]),
    }),
    annotations,
    reports,
    abort: () => controller.abort(),
  }
}

const request = Object.freeze({
  method: 'GET',
  url: '/tickets/7',
  headers: {},
  path: '/tickets/7',
  params: {},
}) as unknown as ServiceRequest

/**
 * Builds a small valid response.
 *
 * @param status - The status code.
 * @param text - The body text.
 * @returns A response with no headers.
 */
const answer = (status: number, text: string): ServiceResponse => ({ status, headers: {}, body: Buffer.from(text) })

/**
 * Builds a stream that produces nothing until the spec pushes into it.
 *
 * @returns A readable the spec feeds by hand.
 */
const quietStream = (): Readable => new Readable({ read: () => undefined })

/**
 * Runs steps the way the listener does: the pipeline behind the outermost boundary.
 *
 * @param steps - The steps, outermost first.
 * @param probe - The recording context.
 * @returns What the outermost boundary resolved with.
 */
const run = (steps: readonly Step[], probe: Probe): Promise<ServiceResponse> =>
  settle(() => runPipeline(steps, request, probe.context), probe.context)

/**
 * Runs steps and gathers everything a spec asserts on.
 *
 * @param steps - The steps, outermost first.
 * @param probe - The recording context; a new one when omitted.
 * @returns The status, the body as text, and what the context recorded.
 */
const seen = async (steps: readonly Step[], probe: Probe = createProbe()): Promise<Record<string, unknown>> => {
  const response = await run(steps, probe)
  return { status: response.status, body: response.body?.toString(), annotations: probe.annotations, reports: probe.reports }
}

const INTERNAL = { status: 500, body: 'Internal Server Error', annotations: [['failure', 'internal']] }

describe('runPipeline', () => {
  it('runs the steps outermost first', async () => {
    const order: string[] = []
    const outer: Step = (_request, _context, next) => (order.push('outer'), next())
    const inner: Step = () => (order.push('inner'), answer(200, 'ok'))
    await run([outer, inner], createProbe())
    expect(order).toEqual(['outer', 'inner'])
  })

  it('lets a step answer alone', async () => {
    const order: string[] = []
    const first: Step = () => (order.push('first'), answer(200, 'ok'))
    const second: Step = () => (order.push('second'), answer(500, 'unreached'))
    await run([first, second], createProbe())
    expect(order).toEqual(['first'])
  })

  it('lets an outer step change what the inner one answered', async () => {
    const outer: Step = async (_request, _context, next) => ({ ...(await next()), status: 202 })
    expect(await seen([outer, () => answer(200, 'ok')])).toEqual({ status: 202, body: 'ok', annotations: [], reports: [] })
  })

  it('answers 404, annotated not-found, past the last step', async () => {
    const pass: Step = (_request, _context, next) => next()
    expect(await seen([pass, pass])).toEqual({ status: 404, body: 'Not Found', annotations: [['failure', 'not-found']], reports: [] })
  })

  it('answers 404 when there is no step at all', async () => {
    expect(await seen([])).toEqual({ status: 404, body: 'Not Found', annotations: [['failure', 'not-found']], reports: [] })
  })

  it('hands what lies past the last step the context and everything the steps added', async () => {
    const probe = createProbe()
    const tenant: Step = (_request, _context, next) => next({ tenant: 't1', region: 'eu' })
    const subject: Step = (_request, _context, next) => next({ subject: 'u1', region: 'us' })
    const past: unknown[] = []
    await runPipeline([tenant, subject], request, probe.context, (context, added) => (past.push({ ...context }, added), answer(200, 'ok')))
    expect(past).toEqual([
      { ...probe.context, tenant: 't1', subject: 'u1', region: 'us' },
      { tenant: 't1', subject: 'u1', region: 'us' },
    ])
  })

  it('hands what lies past the last step nothing added when no step added anything', async () => {
    const probe = createProbe()
    const pass: Step = (_request, _context, next) => next()
    const past: unknown[] = []
    await runPipeline([pass], request, probe.context, (context, added) => (past.push(context === probe.context, added), answer(200, 'ok')))
    expect(past).toEqual([true, undefined])
  })

  it('renders a thrown HttpError and annotates its code', async () => {
    const refuse: Step = () => {
      throw httpError(403, 'forbidden')
    }
    expect(await seen([refuse])).toEqual({ status: 403, body: 'Forbidden', annotations: [['failure', 'forbidden']], reports: [] })
  })

  it('renders a rejected HttpError and annotates its code', async () => {
    const refuse: Step = async () => {
      throw httpError(401, 'unauthenticated', { 'WWW-Authenticate': 'Bearer' })
    }
    expect(await seen([refuse])).toEqual({ status: 401, body: 'Unauthorized', annotations: [['failure', 'unauthenticated']], reports: [] })
  })

  it('carries the headers of a rendered HttpError', async () => {
    const refuse: Step = () => {
      throw httpError(405, 'method-not-allowed', { Allow: 'GET, HEAD' })
    }
    expect((await run([refuse], createProbe())).headers).toEqual({
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      Allow: 'GET, HEAD',
    })
  })

  it.each([
    ['a thrown Error', new RangeError('marker-message'), 'RangeError: marker-message'],
    ['a thrown string', 'marker-text', 'marker-text'],
    ['a thrown undefined', undefined, undefined],
  ])('answers 500, annotated internal, and reports step-failed once for %s', async (_label, value, reported) => {
    const fail: Step = () => {
      throw value
    }
    expect(await seen([fail])).toEqual({ ...INTERNAL, reports: [['step-failed', reported]] })
  })

  it.each([
    ['an Error', new Error('marker-message'), 'Error: marker-message'],
    ['undefined', undefined, undefined],
  ])('answers 500 and reports step-failed once for a rejection with %s', async (_label, value, reported) => {
    const fail: Step = () => Promise.reject(value)
    expect(await seen([fail])).toEqual({ ...INTERNAL, reports: [['step-failed', reported]] })
  })

  it('gives a failing inner step to the outer step as a response, never as a rejection', async () => {
    const statuses: number[] = []
    const outer: Step = async (_request, _context, next) => {
      const response = await next()
      statuses.push(response.status)
      return response
    }
    const fail: Step = () => {
      throw new Error('boom')
    }
    await run([outer, fail], createProbe())
    expect(statuses).toEqual([500])
  })

  it('answers 500 and reports invalid-response once for a return that is no response', async () => {
    const broken: Step = () => ({ status: 200, headers: new Map(), body: null }) as unknown as ServiceResponse
    expect(await seen([broken])).toEqual({ ...INTERNAL, reports: [['invalid-response', 'TypeError: invalid response']] })
  })

  it('releases the stream body of a return that is no response', async () => {
    const body = quietStream()
    const broken: Step = () => ({ status: 99, headers: {}, body })
    await run([broken], createProbe())
    expect(body.destroyed).toBe(true)
  })
})

describe('runPipeline failures', () => {
  it('treats a marked object with a free-text code as a fault and keeps its code out of the annotations', async () => {
    const forged = { [BRAND]: true, status: 403, code: 'marker free text', headers: {} }
    const fail: Step = () => {
      throw forged
    }
    expect(await seen([fail])).toEqual({ ...INTERNAL, reports: [['step-failed', forged]] })
  })

  it('answers 500 and reports invalid-response for a marked failure whose header value holds a line break', async () => {
    const fail: Step = () => {
      throw { [BRAND]: true, status: 403, code: 'forbidden', headers: { 'X-Note': 'ok\r\nSet-Cookie: session=stolen' } }
    }
    expect(await seen([fail])).toEqual({ ...INTERNAL, reports: [['invalid-response', 'TypeError: invalid response']] })
  })

  it('answers 500 and reports invalid-response for a marked failure whose header cannot be read', async () => {
    const headers = Object.defineProperty({}, 'Allow', {
      enumerable: true,
      get: () => {
        throw new Error('unreadable')
      },
    })
    const fail: Step = () => {
      throw { [BRAND]: true, status: 405, code: 'method-not-allowed', headers }
    }
    expect(await seen([fail])).toEqual({ ...INTERNAL, reports: [['invalid-response', 'TypeError: invalid response']] })
  })

  it('answers 500 and reports nothing for a value thrown once the signal has aborted', async () => {
    const probe = createProbe()
    const fail: Step = () => {
      probe.abort()
      throw new Error('aborted work')
    }
    expect(await seen([fail], probe)).toEqual({ ...INTERNAL, reports: [] })
  })

  it('still renders an HttpError thrown once the signal has aborted', async () => {
    const probe = createProbe()
    probe.abort()
    const refuse: Step = () => {
      throw httpError(403, 'forbidden')
    }
    expect(await seen([refuse], probe)).toEqual({ status: 403, body: 'Forbidden', annotations: [['failure', 'forbidden']], reports: [] })
  })

  it('reports nothing for an invalid return once the signal has aborted', async () => {
    const probe = createProbe()
    probe.abort()
    const broken: Step = () => 'not a response' as unknown as ServiceResponse
    expect(await seen([broken], probe)).toEqual({ ...INTERNAL, reports: [] })
  })

  it('reports nothing for a stale stream once the signal has aborted', async () => {
    const probe = createProbe()
    probe.abort()
    const body = quietStream()
    body.destroy()
    expect(await seen([() => ({ status: 200, headers: {}, body })], probe)).toEqual({ ...INTERNAL, reports: [] })
  })
})

describe('runPipeline with a second next()', () => {
  /**
   * Builds a step that calls `next` twice and keeps the first response.
   *
   * @param thrown - Receives what the second call threw.
   * @returns The step.
   */
  const careful =
    (thrown: unknown[]): Step =>
    (_request, _context, next) => {
      const first = next()
      try {
        void next()
      } catch (error) {
        thrown.push(described(error))
      }
      return first
    }

  it('throws synchronously, with a fixed message, and runs the inner steps once', async () => {
    const thrown: unknown[] = []
    const runs: string[] = []
    await run([careful(thrown), () => (runs.push('inner'), answer(200, 'ok'))], createProbe())
    expect({ thrown, runs }).toEqual({ thrown: ['Error: next() was called more than once.'], runs: ['inner'] })
  })

  it('leaves the first response with a step that catches the throw', async () => {
    expect(await seen([careful([]), () => answer(200, 'first')])).toEqual({ status: 200, body: 'first', annotations: [], reports: [] })
  })

  it('answers 500 when an async step ignores the result of its second call', async () => {
    const careless: Step = async (_request, _context, next) => {
      void next()
      void next()
      return answer(200, 'unreached')
    }
    const result = await seen([careless, () => answer(200, 'inner')])
    await flushPromises()
    expect(result).toEqual({ ...INTERNAL, reports: [['step-failed', 'Error: next() was called more than once.']] })
  })

  it('answers 500 when a plain step lets the throw leave it', async () => {
    const careless: Step = (_request, _context, next) => {
      void next()
      return next()
    }
    expect(await seen([careless, () => answer(200, 'inner')])).toEqual({
      ...INTERNAL,
      reports: [['step-failed', 'Error: next() was called more than once.']],
    })
  })
})

describe('runPipeline with stream bodies', () => {
  it('gives an accepted stream body the kernel error listener', async () => {
    const body = quietStream()
    await run([() => ({ status: 200, headers: {}, body })], createProbe())
    expect(body.listenerCount('error')).toBe(1)
  })

  it('gives a stream body one listener however many boundaries it passes', async () => {
    const body = quietStream()
    const pass: Step = (_request, _context, next) => next()
    await run([pass, pass, () => ({ status: 200, headers: {}, body })], createProbe())
    expect(body.listenerCount('error')).toBe(1)
  })

  it('answers 500 and reports stream-failed once for a body that fails while an outer step holds it', async () => {
    const probe = createProbe()
    const body = quietStream()
    const held = createDeferred<void>()
    const outer: Step = async (_request, _context, next) => {
      const response = await next()
      await held.promise
      return response
    }
    const pending = run([outer, () => ({ status: 200, headers: {}, body })], probe)
    await flushPromises()
    body.destroy(new RangeError('the source failed'))
    await flushPromises()
    held.resolve()
    const response = await pending
    expect({ status: response.status, annotations: probe.annotations, reports: probe.reports }).toEqual({
      status: 500,
      annotations: [['failure', 'internal']],
      reports: [['stream-failed', 'RangeError: the source failed']],
    })
  })

  it('answers 500 for a stream that was already read from, and releases it', async () => {
    const body = quietStream()
    body.push('chunk')
    body.read()
    const response = await run([() => ({ status: 200, headers: {}, body })], createProbe())
    expect({ status: response.status, destroyed: body.destroyed }).toEqual({ status: 500, destroyed: true })
  })

  it('reports a stale stream that carries no error of its own as a plain Error', async () => {
    const probe = createProbe()
    const body = quietStream()
    body.destroy()
    await run([() => ({ status: 200, headers: {}, body })], probe)
    expect(probe.reports).toEqual([['stream-failed', 'Error: the stream body was already used']])
  })

  it('releases the inner stream when a step throws after next() resolved', async () => {
    const body = quietStream()
    const outer: Step = async (_request, _context, next) => {
      await next()
      throw new Error('boom')
    }
    await run([outer, () => ({ status: 200, headers: {}, body })], createProbe())
    await flushPromises()
    expect(body.destroyed).toBe(true)
  })

  it('releases the inner stream, once it arrives, when a step throws while next() is pending', async () => {
    const body = quietStream()
    const arrival = createDeferred<void>()
    const outer: Step = (_request, _context, next) => {
      void next()
      throw new Error('boom')
    }
    const inner: Step = async () => {
      await arrival.promise
      return { status: 200, headers: {}, body }
    }
    await run([outer, inner], createProbe())
    const before = body.destroyed
    arrival.resolve()
    await flushPromises()
    expect({ before, after: body.destroyed }).toEqual({ before: false, after: true })
  })

  it('releases the inner stream when a step rejects with an HttpError after next()', async () => {
    const body = quietStream()
    const outer: Step = async (_request, _context, next) => {
      await next()
      throw httpError(409, 'conflict')
    }
    await run([outer, () => ({ status: 200, headers: {}, body })], createProbe())
    await flushPromises()
    expect(body.destroyed).toBe(true)
  })

  it('leaves the inner stream alone when a step returns the response it was given', async () => {
    const body = quietStream()
    const pass: Step = async (_request, _context, next) => next()
    await run([pass, () => ({ status: 200, headers: {}, body })], createProbe())
    await flushPromises()
    expect(body.destroyed).toBe(false)
  })
})

describe('settle', () => {
  it('resolves with the very response a synchronous run returned', async () => {
    const response = answer(200, 'ok')
    expect(await settle(() => response, createProbe().context)).toBe(response)
  })

  it('resolves with the response of a run that returned a promise', async () => {
    const response = answer(200, 'ok')
    expect(await settle(() => Promise.resolve(response), createProbe().context)).toBe(response)
  })

  it('resolves, never rejects, for a run that throws synchronously', async () => {
    const run500 = settle(() => {
      throw new Error('boom')
    }, createProbe().context)
    expect((await run500).status).toBe(500)
  })

  it('builds a new 500 for every fault', async () => {
    const fail = (): ServiceResponse => {
      throw new Error('boom')
    }
    const [first, second] = [await settle(fail, createProbe().context), await settle(fail, createProbe().context)]
    expect(first).not.toBe(second)
  })
})

describe('settle with a body behind a getter', () => {
  /**
   * Builds a response whose body is read through a getter that counts its reads and may fail from one of them on.
   *
   * @param failFrom - The read from which the getter throws; none when omitted.
   * @returns The response and its counter.
   */
  const lazy = (failFrom = Number.POSITIVE_INFINITY): { response: ServiceResponse; reads: () => number } => {
    let reads = 0
    const response = {
      status: 200,
      headers: {},
      get body(): Buffer {
        reads += 1
        if (reads >= failFrom) throw new Error('already taken')
        return Buffer.from('ok')
      },
    }
    return { response, reads: () => reads }
  }

  it('resolves with the 500, never rejects, for a body whose getter throws on its second read', async () => {
    expect((await settle(() => lazy(2).response, createProbe().context)).status).toBe(500)
  })

  it('reports a body whose getter throws on its second read as an invalid response', async () => {
    const probe = createProbe()
    await settle(() => lazy(2).response, probe.context)
    expect(probe.reports).toEqual([['invalid-response', 'TypeError: invalid response']])
  })

  it('reads the body once after the response check, whatever the body is', async () => {
    const { response, reads } = lazy()
    await settle(() => response, createProbe().context)
    expect(reads()).toBe(2)
  })
})
