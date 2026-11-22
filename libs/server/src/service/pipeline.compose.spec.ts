import type { BaseContext, Handler, NoContext, ServiceRequest, ServiceResponse, Step, StepContext } from './contract'
import { describe, expect, it } from '@hyperfrontend/testing'
import { httpError } from './http-error'
import { chain, extendContext, guard, runPipeline, settle } from './pipeline'

/** What one layer of the context adds. */
interface Tenant {
  /** The tenant the request belongs to. */
  readonly tenant: string
}

/** What a second layer of the context adds. */
interface Subject {
  /** Who is calling. */
  readonly subject: string
}

/** A context that records what the boundary writes to it. */
interface Probe {
  /** The context handed to the pipeline. */
  readonly context: BaseContext
  /** Every `annotate` call, in order. */
  readonly annotations: unknown[][]
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

const request = Object.freeze({
  method: 'GET',
  url: '/tickets/7',
  headers: {},
  path: '/tickets/7',
  params: Object.freeze({ id: '7' }),
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
 * Runs steps the way the listener does: the pipeline behind the outermost boundary.
 *
 * @param steps - The steps, outermost first.
 * @param context - The context of the request.
 * @returns What the outermost boundary resolved with.
 */
const run = (steps: readonly Step[], context: BaseContext): Promise<ServiceResponse> =>
  settle(() => runPipeline(steps, request, context), context)

/**
 * Builds a step that adds one layer to the context and delegates.
 *
 * @param extra - The layer to add.
 * @returns The step.
 */
const adds =
  <Adds extends object>(extra: Adds): Step<NoContext, Adds> =>
  (_request, _context, next) =>
    (next as (extra: Adds) => Promise<ServiceResponse>)(extra)

/**
 * Builds a terminal step that records the context it was given.
 *
 * @param contexts - Receives the context.
 * @returns The step.
 */
const capture =
  (contexts: object[]): Step =>
  (_request, context) => (contexts.push(context), answer(200, 'ok'))

describe('the context a step extends', () => {
  it('reaches the steps inside and never the step that added it', async () => {
    const { context } = createProbe()
    const contexts: object[] = []
    const outer: Step<NoContext, Tenant> = async (_request, own, next) => {
      const response = await next({ tenant: 't1' })
      contexts.push(own)
      return response
    }
    await run([outer, capture(contexts)], context)
    expect(contexts).toEqual([{ ...context, tenant: 't1' }, context])
  })

  it('lets a later addition shadow an earlier one of the same name', async () => {
    const { context } = createProbe()
    const contexts: object[] = []
    await run([adds({ tenant: 't1', region: 'eu' }), adds({ tenant: 't2' }), capture(contexts)], context)
    expect(contexts).toEqual([{ ...context, tenant: 't2', region: 'eu' }])
  })

  it('keeps signal, client, annotate and report against an addition that names them', async () => {
    const { context } = createProbe()
    const contexts: object[] = []
    await run(
      [adds({ signal: 'forged', client: 'forged', annotate: 'forged', report: 'forged', tenant: 't1' }), capture(contexts)],
      context
    )
    expect(contexts).toEqual([{ ...context, tenant: 't1' }])
  })

  it('is frozen', async () => {
    const contexts: object[] = []
    await run([adds({ tenant: 't1' }), capture(contexts)], createProbe().context)
    expect(contexts.map((context) => Object.isFrozen(context))).toEqual([true])
  })

  it('is the same object when next() is given nothing', async () => {
    const { context } = createProbe()
    const contexts: object[] = []
    await run([(_request, _context, next) => next(), capture(contexts)], context)
    expect(contexts[0]).toBe(context)
  })

  it('is the same object when next() is given undefined', async () => {
    const { context } = createProbe()
    const contexts: object[] = []
    await run([(_request, _context, next) => next(undefined), capture(contexts)], context)
    expect(contexts[0]).toBe(context)
  })

  it('is a new object when next() is given an empty addition', async () => {
    const { context } = createProbe()
    const contexts: object[] = []
    await run([adds({}), capture(contexts)], context)
    expect(contexts[0]).not.toBe(context)
  })
})

describe('extendContext', () => {
  it('returns the context itself when nothing is added', () => {
    const { context } = createProbe()
    expect(extendContext(context, undefined)).toBe(context)
  })

  it('returns a frozen copy with the addition', () => {
    const { context } = createProbe()
    const extended = extendContext(context, { tenant: 't1' })
    expect({ extended, frozen: Object.isFrozen(extended) }).toEqual({ extended: { ...context, tenant: 't1' }, frozen: true })
  })

  it('keeps the four members of the base context against an addition that names them', () => {
    const { context } = createProbe()
    expect(extendContext(context, { signal: null, client: null, annotate: null, report: null })).toEqual(context)
  })

  it('keeps what an earlier layer added', () => {
    const { context } = createProbe()
    expect(extendContext(extendContext(context, { tenant: 't1' }), { subject: 'u1' })).toEqual({ ...context, tenant: 't1', subject: 'u1' })
  })

  it('leaves the context it extends as it was', () => {
    const { context } = createProbe()
    extendContext(context, { tenant: 't1' })
    expect('tenant' in context).toBe(false)
  })
})

describe('chain', () => {
  /**
   * Builds a step that records its name and delegates.
   *
   * @param order - Receives the name.
   * @param name - The name to record.
   * @returns The step.
   */
  const named =
    (order: string[], name: string): Step =>
    (_request, _context, next) => (order.push(name), next())

  it('runs its steps in order', async () => {
    const order: string[] = []
    await run([chain(named(order, 'first'), named(order, 'second'))], createProbe().context)
    expect(order).toEqual(['first', 'second'])
  })

  it('runs three and four steps in order', async () => {
    const order: string[] = []
    const { context } = createProbe()
    await run([chain(named(order, 'a'), named(order, 'b'), named(order, 'c'))], context)
    await run([chain(named(order, 'd'), named(order, 'e'), named(order, 'f'), named(order, 'g'))], context)
    expect(order).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
  })

  it('lets its second step read what its first added', async () => {
    const tenants: string[] = []
    const reads: Step<Tenant> = (_request, context) => (tenants.push(context.tenant), answer(200, 'ok'))
    await run([chain(adds<Tenant>({ tenant: 't1' }), reads)], createProbe().context)
    expect(tenants).toEqual(['t1'])
  })

  it('hands everything its steps added to the step after it', async () => {
    const { context } = createProbe()
    const contexts: object[] = []
    await run([chain(adds<Tenant>({ tenant: 't1' }), adds<Subject>({ subject: 'u1' })), capture(contexts)], context)
    expect(contexts).toEqual([{ ...context, tenant: 't1', subject: 'u1' }])
  })

  it('hands on the later of two additions under one name', async () => {
    const { context } = createProbe()
    const contexts: object[] = []
    await run([chain(adds<Tenant>({ tenant: 't1' }), adds<Tenant>({ tenant: 't2' })), capture(contexts)], context)
    expect(contexts).toEqual([{ ...context, tenant: 't2' }])
  })

  it('hands on the same context object when its steps added nothing', async () => {
    const { context } = createProbe()
    const contexts: object[] = []
    await run([chain(named([], 'first'), named([], 'second')), capture(contexts)], context)
    expect(contexts[0]).toBe(context)
  })

  it('answers 404 when nothing follows it', async () => {
    expect((await run([chain(named([], 'first'), named([], 'second'))], createProbe().context)).status).toBe(404)
  })

  it('resolves the next() of its outer step with a failure of its inner step', async () => {
    const probe = createProbe()
    const statuses: number[] = []
    const outer: Step = async (_request, _context, next) => {
      const response = await next()
      statuses.push(response.status)
      return response
    }
    const refuse: Step = () => {
      throw httpError(401, 'unauthenticated')
    }
    await run([chain(outer, refuse)], probe.context)
    expect({ statuses, annotations: probe.annotations }).toEqual({ statuses: [401], annotations: [['failure', 'unauthenticated']] })
  })

  it('resolves the next() of its last step with a failure of the step after it', async () => {
    const statuses: number[] = []
    const last: Step = async (_request, _context, next) => {
      const response = await next()
      statuses.push(response.status)
      return response
    }
    const fail: Step = () => {
      throw new Error('boom')
    }
    await run([chain(named([], 'first'), last), fail], createProbe().context)
    expect(statuses).toEqual([500])
  })

  it('nests', async () => {
    const { context } = createProbe()
    const contexts: object[] = []
    const inner = chain(adds<Subject>({ subject: 'u1' }), adds({ role: 'writer' }))
    await run([chain(adds<Tenant>({ tenant: 't1' }), inner), capture(contexts)], context)
    expect(contexts).toEqual([{ ...context, tenant: 't1', subject: 'u1', role: 'writer' }])
  })
})

describe('guard', () => {
  /**
   * Runs a guarded handler behind the boundary a router call sits behind.
   *
   * @param handler - The handler `guard` returned.
   * @param probe - The recording context.
   * @returns What the boundary resolved with.
   */
  const runGuarded = (handler: Handler, probe: Probe): Promise<ServiceResponse> =>
    settle(() => handler(request, probe.context), probe.context)

  it('runs the step, then the handler', async () => {
    const order: string[] = []
    const step: Step = (_request, _context, next) => (order.push('step'), next())
    await runGuarded(
      guard(step, () => (order.push('handler'), answer(200, 'ok'))),
      createProbe()
    )
    expect(order).toEqual(['step', 'handler'])
  })

  it('answers with what the handler returned', async () => {
    const pass: Step = (_request, _context, next) => next()
    const response = await runGuarded(
      guard(pass, () => answer(200, 'guarded')),
      createProbe()
    )
    expect({ status: response.status, body: response.body?.toString() }).toEqual({ status: 200, body: 'guarded' })
  })

  it('gives the handler the context the step extended', async () => {
    const probe = createProbe()
    const contexts: StepContext<Tenant>[] = []
    await runGuarded(
      guard(adds<Tenant>({ tenant: 't1' }), (_request, context) => (contexts.push(context), answer(200, 'ok'))),
      probe
    )
    expect(contexts).toEqual([{ ...probe.context, tenant: 't1' }])
  })

  it('gives the handler the request it was called with', async () => {
    const requests: ServiceRequest[] = []
    const pass: Step = (_request, _context, next) => next()
    await runGuarded(
      guard(pass, (received) => (requests.push(received), answer(200, 'ok'))),
      createProbe()
    )
    expect(requests[0]).toBe(request)
  })

  it('gives the step the request it was called with', async () => {
    const requests: ServiceRequest[] = []
    const reads: Step = (received, _context, next) => (requests.push(received), next())
    await runGuarded(
      guard(reads, () => answer(200, 'ok')),
      createProbe()
    )
    expect(requests[0]).toBe(request)
  })

  it('skips the handler when the step refuses', async () => {
    const probe = createProbe()
    const order: string[] = []
    const refuse: Step = () => {
      throw httpError(401, 'unauthenticated', { 'WWW-Authenticate': 'Bearer' })
    }
    const response = await runGuarded(
      guard(refuse, () => (order.push('handler'), answer(200, 'ok'))),
      probe
    )
    expect({ status: response.status, order, annotations: probe.annotations }).toEqual({
      status: 401,
      order: [],
      annotations: [['failure', 'unauthenticated']],
    })
  })

  it('shows the step the params of the route', async () => {
    const ids: unknown[] = []
    const reads: Step = (received, _context, next) => (ids.push(received.params['id']), next())
    await runGuarded(
      guard(reads, () => answer(200, 'ok')),
      createProbe()
    )
    expect(ids).toEqual(['7'])
  })

  it('renders a failure of the handler at the next() of the step', async () => {
    const statuses: number[] = []
    const watch: Step = async (_request, _context, next) => {
      const response = await next()
      statuses.push(response.status)
      return response
    }
    await runGuarded(
      guard(watch, () => {
        throw httpError(410, 'gone')
      }),
      createProbe()
    )
    expect(statuses).toEqual([410])
  })

  it('throws into its own step for a second next(), and runs the handler once', async () => {
    const runs: string[] = []
    const twice: Step = (_request, _context, next) => {
      void next()
      return next()
    }
    const response = await runGuarded(
      guard(twice, () => (runs.push('handler'), answer(200, 'ok'))),
      createProbe()
    )
    expect({ status: response.status, runs }).toEqual({ status: 500, runs: ['handler'] })
  })
})
