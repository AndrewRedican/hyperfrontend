import type { BaseContext, ServiceRequest, ServiceResponse, Step } from './contract'
import type { ReadinessOptions } from './health'
import { createDeferred, describe, expect, it } from '@hyperfrontend/testing'
import { health, readiness } from './health'
import { settle } from './pipeline'

/** A context that records what is written to it. */
interface Probe {
  /** The context handed to the step. */
  readonly context: BaseContext
  /** Every `annotate` call, in order. */
  readonly annotations: unknown[][]
  /** Every `report` call, in order. */
  readonly reports: unknown[][]
}

/** What a spec asserts on after one request went through a step. */
interface Seen {
  /** The status of the response. */
  readonly status: number
  /** The headers of the response. */
  readonly headers: Readonly<Record<string, string>>
  /** The body of the response as text, or `null`. */
  readonly body: string | null
  /** How many times the step called `next`. */
  readonly delegated: number
  /** Every `annotate` call, in order. */
  readonly annotations: unknown[][]
  /** Every `report` call, in order. */
  readonly reports: unknown[][]
}

/** What a readiness probe answered, parsed. */
interface Answer {
  /** The status of the response. */
  readonly status: number
  /** The JSON document of the body. */
  readonly document: unknown
}

// note: A clock for specs that never let a timer fire: it hands out a handle and forgets it.
const idleClock = Object.freeze({ now: () => 0, setTimeout: () => null, clearTimeout: () => undefined })

/**
 * Builds a frozen context that records its calls.
 *
 * @returns The context and what it recorded.
 */
const createProbe = (): Probe => {
  const annotations: unknown[][] = []
  const reports: unknown[][] = []
  return {
    context: Object.freeze({
      signal: new AbortController().signal,
      client: Object.freeze({ address: '192.0.2.7' }),
      annotate: (name: string, value: string | number | boolean) => void annotations.push([name, value]),
      report: (code: string, error: unknown) => void reports.push([code, error]),
    }),
    annotations,
    reports,
  }
}

/**
 * Builds a request the way the listener does: frozen, with a canonical path.
 *
 * @param method - GET, POST and so on, as Node hands it over.
 * @param canonical - What the listener decoded the target to.
 * @returns The frozen request.
 */
const requestFor = (method: string, canonical: string): ServiceRequest =>
  Object.freeze({
    method,
    url: `${canonical}?verbose=1`,
    headers: Object.freeze(Object.create(null)),
    path: canonical,
    query: Object.freeze({}),
    params: Object.freeze(Object.create(null)),
    body: Object.freeze({ length: null }),
  }) as unknown as ServiceRequest

/**
 * Runs a step behind the boundary the listener puts around a pipeline, with a `next` that answers 404, and gathers what a spec asserts on.
 *
 * @param step - The step under test.
 * @param method - The request method.
 * @param canonical - The canonical path.
 * @returns The response in plain values, the number of delegations and what the context recorded.
 */
const seen = async (step: Step, method: string, canonical: string): Promise<Seen> => {
  const probe = createProbe()
  let delegated = 0
  const next = (): Promise<ServiceResponse> => ((delegated += 1), Promise.resolve({ status: 404, headers: {}, body: null }))
  const response = await settle(() => step(requestFor(method, canonical), probe.context, next), probe.context)
  return {
    status: response.status,
    headers: response.headers,
    body: response.body === null ? null : response.body.toString(),
    delegated,
    annotations: probe.annotations,
    reports: probe.reports,
  }
}

/**
 * Probes a readiness step once and parses what it answered.
 *
 * @param step - The readiness step.
 * @returns The status and the JSON document.
 */
const answerOf = async (step: Step): Promise<Answer> => {
  const { status, body } = await seen(step, 'GET', '/readyz')
  return { status, document: JSON.parse(String(body)) }
}

/**
 * Builds a readiness step on a clock whose timers never fire, so that no spec arms a timer of the system.
 *
 * @param options - The options of the step.
 * @returns The step.
 */
const timed = (options: ReadinessOptions): Step => readiness(options, { clock: idleClock })

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

describe('health', () => {
  it('answers GET on /healthz with 200 ok that is never stored', async () => {
    expect(await seen(health(), 'GET', '/healthz')).toEqual({
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      body: 'ok',
      delegated: 0,
      annotations: [],
      reports: [],
    })
  })

  it('answers HEAD with the response of a GET', async () => {
    expect(await seen(health(), 'HEAD', '/healthz')).toEqual(await seen(health(), 'GET', '/healthz'))
  })

  it('answers synchronously, so a probe waits on nothing', () => {
    const response = health()(requestFor('GET', '/healthz'), createProbe().context, () => Promise.reject(new Error('delegated')))
    expect(response).toEqual({ status: 200, headers: expect.any(Object), body: Buffer.from('ok') })
  })

  it('builds a new response for each request', () => {
    const step = health()
    const ask = (): unknown => step(requestFor('GET', '/healthz'), createProbe().context, () => Promise.reject(new Error('delegated')))
    expect(ask()).not.toBe(ask())
  })

  it('refuses another method with 405 and the methods it answers', async () => {
    const { status, headers, annotations, delegated } = await seen(health(), 'POST', '/healthz')
    expect({ status, allow: headers['Allow'], annotations, delegated }).toEqual({
      status: 405,
      allow: 'GET, HEAD',
      annotations: [['failure', 'method-not-allowed']],
      delegated: 0,
    })
  })

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])('refuses %s', async (method) => {
    expect((await seen(health(), method, '/healthz')).status).toBe(405)
  })

  it('throws the refusal as a failure a step may catch', () => {
    const thrown = thrownBy(() =>
      health()(requestFor('DELETE', '/healthz'), createProbe().context, () => Promise.reject(new Error('delegated')))
    )
    expect(thrown).toMatchObject({ name: 'HttpError', status: 405, code: 'method-not-allowed', headers: { Allow: 'GET, HEAD' } })
  })

  it('delegates a request for another path', async () => {
    const { status, delegated } = await seen(health(), 'GET', '/tickets')
    expect({ status, delegated }).toEqual({ status: 404, delegated: 1 })
  })

  it('delegates another method on another path', async () => {
    expect((await seen(health(), 'POST', '/tickets')).delegated).toBe(1)
  })

  it.each(['/healthz/', '/Healthz', '/healthz/deep', '/'])('delegates %s, which is not the path', async (canonical) => {
    expect((await seen(health(), 'GET', canonical)).delegated).toBe(1)
  })

  it('answers on a custom path', async () => {
    expect((await seen(health({ path: '/internal/live' }), 'GET', '/internal/live')).body).toBe('ok')
  })

  it('answers on the root when the root is the path', async () => {
    expect((await seen(health({ path: '/' }), 'GET', '/')).body).toBe('ok')
  })

  it('delegates /healthz when a custom path replaces it', async () => {
    expect((await seen(health({ path: '/internal/live' }), 'GET', '/healthz')).delegated).toBe(1)
  })

  it('takes /healthz when the options name no path', async () => {
    expect((await seen(health({}), 'GET', '/healthz')).status).toBe(200)
  })

  it.each([['/probe/:name'], ['/files/*rest'], ['/healthz/'], ['healthz'], [''], ['/a//b'], [7], [null]])(
    'refuses the path %j at construction',
    (path) => {
      expect(thrownBy(() => health({ path: path as string }))).toEqual(
        new TypeError('health: "path" must be a static pattern such as "/healthz".')
      )
    }
  )

  it('refuses a faulty path with a TypeError', () => {
    expect(thrownBy(() => health({ path: '/probe/:name' }))).toBeInstanceOf(TypeError)
  })
})

describe('readiness', () => {
  it('answers 200 with no checks', async () => {
    expect(await answerOf(readiness())).toEqual({ status: 200, document: { ready: true, checks: {} } })
  })

  it('answers JSON that is never stored', async () => {
    expect((await seen(readiness(), 'GET', '/readyz')).headers).toEqual({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    })
  })

  it('answers 200 when every check is true', async () => {
    expect(await answerOf(timed({ checks: { store: () => true, queue: async () => true } }))).toEqual({
      status: 200,
      document: { ready: true, checks: { store: true, queue: true } },
    })
  })

  it('answers 503 when one check is false', async () => {
    expect(await answerOf(timed({ checks: { store: () => true, queue: () => false } }))).toEqual({
      status: 503,
      document: { ready: false, checks: { store: true, queue: false } },
    })
  })

  it.each([
    ['a truthy number', (): unknown => 1],
    ['a truthy string', (): unknown => 'true'],
    ['an object', (): unknown => ({ ready: true })],
    ['nothing', (): unknown => undefined],
    ['a promise for a truthy number', (): unknown => Promise.resolve(1)],
  ])('counts a check that gives %s as not ready', async (_label, check) => {
    expect(await answerOf(timed({ checks: { store: check as () => boolean } }))).toEqual({
      status: 503,
      document: { ready: false, checks: { store: false } },
    })
  })

  it('counts a check that throws as not ready', async () => {
    const failing = (): boolean => {
      throw new RangeError('store.internal:5432 refused')
    }
    expect(await answerOf(timed({ checks: { store: failing } }))).toEqual({
      status: 503,
      document: { ready: false, checks: { store: false } },
    })
  })

  it('reports a check that throws once, with what it threw', async () => {
    const fault = new RangeError('store.internal:5432 refused')
    const failing = (): boolean => {
      throw fault
    }
    expect((await seen(timed({ checks: { store: failing } }), 'GET', '/readyz')).reports).toEqual([['readiness-check-failed', fault]])
  })

  it('counts a check that rejects as not ready', async () => {
    expect(await answerOf(timed({ checks: { store: () => Promise.reject(new Error('down')) } }))).toEqual({
      status: 503,
      document: { ready: false, checks: { store: false } },
    })
  })

  it('reports a check that rejects once, with what it rejected with', async () => {
    const fault = new Error('down')
    expect((await seen(timed({ checks: { store: () => Promise.reject(fault) } }), 'GET', '/readyz')).reports).toEqual([
      ['readiness-check-failed', fault],
    ])
  })

  it('reports nothing for a check that is merely not ready', async () => {
    expect((await seen(timed({ checks: { store: () => false } }), 'GET', '/readyz')).reports).toEqual([])
  })

  it('answers with names and booleans only, in declaration order, whatever a check threw', async () => {
    const failing = (): boolean => {
      throw new Error('secret-marker')
    }
    expect((await seen(timed({ checks: { queue: () => true, store: failing, cache: () => true } }), 'GET', '/readyz')).body).toBe(
      '{"ready":false,"checks":{"queue":true,"store":false,"cache":true}}'
    )
  })

  it('asks every check before any of them settles', () => {
    const asked: string[] = []
    const pending = (name: string) => (): Promise<boolean> => (asked.push(name), createDeferred<boolean>().promise)
    const step = readiness({ checks: { store: pending('store'), queue: pending('queue'), cache: pending('cache') } }, { clock: idleClock })
    void step(requestFor('GET', '/readyz'), createProbe().context, () => Promise.reject(new Error('delegated')))
    expect(asked).toEqual(['store', 'queue', 'cache'])
  })

  it('hands each check a signal that has not aborted', async () => {
    const signals: AbortSignal[] = []
    await answerOf(readiness({ checks: { store: (signal) => signals.push(signal) > 0 } }, { clock: idleClock }))
    expect(signals.map((signal) => [signal instanceof AbortSignal, signal.aborted])).toEqual([[true, false]])
  })

  it('runs the checks for HEAD and answers as for GET', async () => {
    const { status, body } = await seen(readiness({ checks: { store: () => false } }, { clock: idleClock }), 'HEAD', '/readyz')
    expect({ status, body }).toEqual({ status: 503, body: '{"ready":false,"checks":{"store":false}}' })
  })

  it('refuses another method with 405 and the methods it answers', async () => {
    const { status, headers, delegated } = await seen(readiness(), 'POST', '/readyz')
    expect({ status, allow: headers['Allow'], delegated }).toEqual({ status: 405, allow: 'GET, HEAD', delegated: 0 })
  })

  it('asks no check for a method it refuses', async () => {
    let asked = 0
    await seen(readiness({ checks: { store: () => (asked += 1) > 0 } }, { clock: idleClock }), 'DELETE', '/readyz')
    expect(asked).toBe(0)
  })

  it('delegates a request for another path', async () => {
    const { status, delegated } = await seen(readiness(), 'GET', '/healthz')
    expect({ status, delegated }).toEqual({ status: 404, delegated: 1 })
  })

  it('asks no check for another path', async () => {
    let asked = 0
    await seen(readiness({ checks: { store: () => (asked += 1) > 0 } }, { clock: idleClock }), 'GET', '/tickets')
    expect(asked).toBe(0)
  })

  it('answers on a custom path', async () => {
    expect((await seen(readiness({ path: '/internal/ready' }), 'GET', '/internal/ready')).status).toBe(200)
  })

  it('delegates /readyz when a custom path replaces it', async () => {
    expect((await seen(readiness({ path: '/internal/ready' }), 'GET', '/readyz')).delegated).toBe(1)
  })

  it('keeps time on the system clock when the deps name no clock, without touching it while there is no check', async () => {
    expect((await seen(readiness({}, {}), 'GET', '/readyz')).status).toBe(200)
  })
})

describe('readiness construction', () => {
  it('names every problem in one error, in a fixed order', () => {
    const options = {
      path: '/ready/:name',
      timeoutMs: 0,
      checks: { store: 'up', 'bad name': () => true, [`a${'b'.repeat(64)}`]: 7 },
    }
    expect(thrownBy(() => readiness(options as never))).toEqual(
      new Error(
        [
          'Invalid readiness options:',
          '  - "path" must be a static pattern such as "/readyz".',
          '  - "timeoutMs" must be a positive integer.',
          '  - "checks.store" must be a function.',
          '  - "checks.bad name": a check name must be 1 to 64 characters of letters, digits, ".", "_", ":" or "-", starting with a letter or digit.',
          `  - "checks.a${'b'.repeat(64)}" must be a function.`,
          `  - "checks.a${'b'.repeat(64)}": a check name must be 1 to 64 characters of letters, digits, ".", "_", ":" or "-", starting with a letter or digit.`,
        ].join('\n')
      )
    )
  })

  it.each([['/readyz/'], ['readyz'], ['/files/*rest'], [5]])('refuses the path %j', (path) => {
    expect(thrownBy(() => readiness({ path: path as string }))).toEqual(
      new Error('Invalid readiness options:\n  - "path" must be a static pattern such as "/readyz".')
    )
  })

  it.each([[0], [-1], [1.5], [2147483648], [Number.NaN], ['2000'], [null]])('refuses the timeoutMs %j', (timeoutMs) => {
    expect(thrownBy(() => readiness({ timeoutMs: timeoutMs as number }))).toEqual(
      new Error('Invalid readiness options:\n  - "timeoutMs" must be a positive integer.')
    )
  })

  it.each([[1], [2147483647]])('accepts the timeoutMs %j', (timeoutMs) => {
    expect(thrownBy(() => readiness({ timeoutMs }))).toBeUndefined()
  })

  it.each([['_store'], ['-store'], [''], ['store/primary'], ['st\u00f6re'], ['__proto__']])('refuses the check name %j', (name) => {
    expect(thrownBy(() => readiness({ checks: Object.fromEntries([[name, () => true]]) }))).toEqual(
      new Error(
        `Invalid readiness options:\n  - "checks.${name}": a check name must be 1 to 64 characters of letters, digits, ".", "_", ":" or "-", starting with a letter or digit.`
      )
    )
  })

  it.each([['store'], ['0'], ['Store.primary_1:eu-west'], ['a'.repeat(64)]])('accepts the check name %j', (name) => {
    expect(thrownBy(() => readiness({ checks: Object.fromEntries([[name, () => true]]) }))).toBeUndefined()
  })

  it.each([
    ['a Map', new Map([['store', () => true]])],
    ['an array', [() => true]],
    ['a function', () => true],
    ['a string', 'store'],
    ['null', null],
  ])('refuses checks given as %s', (_label, checks) => {
    expect(thrownBy(() => readiness({ checks: checks as never }))).toEqual(
      new Error('Invalid readiness options:\n  - "checks" must be a plain object of functions.')
    )
  })

  it('accepts checks in an object without a prototype', async () => {
    const checks = Object.assign(Object.create(null) as Record<string, () => boolean>, { store: () => true })
    expect(await answerOf(readiness({ checks }, { clock: idleClock }))).toEqual({
      status: 200,
      document: { ready: true, checks: { store: true } },
    })
  })

  it('reads the checks once, so a check added later is never asked', async () => {
    const checks: Record<string, () => boolean> = { store: () => true }
    const step = readiness({ checks }, { clock: idleClock })
    checks['queue'] = () => false
    expect(await answerOf(step)).toEqual({ status: 200, document: { ready: true, checks: { store: true } } })
  })
})
