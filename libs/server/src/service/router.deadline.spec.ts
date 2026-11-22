import type { ServiceClock } from './clock'
import type { BaseContext, Handler, ServiceRequest, ServiceResponse, Step, StepContext } from './contract'
import { getEventListeners } from 'node:events'
import { Readable } from 'node:stream'
import { createDeferred, describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { settle } from './pipeline'
import { route, router } from './router'

/** One timer a fake clock was asked for. */
interface FakeTimer {
  /** The delay asked for. */
  readonly ms: number
  /** Whether the timer was taken back. */
  cleared: boolean
  /** Runs the timer's callback, as the clock would at the deadline. */
  fire(): void
}

/** A clock that keeps its timers for the spec to fire. */
interface FakeClock {
  /** The clock handed to the router. */
  readonly clock: ServiceClock
  /** Every timer started, in order. */
  readonly timers: FakeTimer[]
  /** The name of every clock method called, in order. */
  readonly calls: string[]
}

/** A context that records what is written to it. */
interface Probe {
  /** The context handed to the router. */
  readonly context: BaseContext
  /** Every `annotate` call, in order. */
  readonly annotations: unknown[][]
  /** Every `report` call, in order. */
  readonly reports: unknown[][]
  /** Aborts the request's signal. */
  abort(): void
}

/** A router with one slow route, dispatched once. */
interface Dispatch {
  /** What the router returned, settled behind the boundary the listener puts around a pipeline. */
  readonly settled: Promise<ServiceResponse>
  /** The fake clock the router was built with. */
  readonly time: FakeClock
  /** The request's context. */
  readonly probe: Probe
  /** The contexts the handler was called with. */
  readonly received: StepContext[]
}

/**
 * Builds a clock whose timers fire only when the spec says so.
 *
 * @returns The clock, its timers and the calls made to it.
 */
const createClock = (): FakeClock => {
  const timers: FakeTimer[] = []
  const calls: string[] = []
  return {
    timers,
    calls,
    clock: {
      now: () => calls.push('now'),
      setTimeout: (callback, ms) => {
        calls.push('setTimeout')
        const timer: FakeTimer = { ms, cleared: false, fire: callback }
        timers.push(timer)
        return timer
      },
      clearTimeout: (handle) => {
        calls.push('clearTimeout')
        ;(handle as FakeTimer).cleared = true
      },
    },
  }
}

/**
 * Builds a frozen context that records its calls and whose signal the spec can abort.
 *
 * @param extra - Keys an outer step added to the context.
 * @returns The context and what it recorded.
 */
const createProbe = (extra: object = {}): Probe => {
  const controller = new AbortController()
  const annotations: unknown[][] = []
  const reports: unknown[][] = []
  return {
    context: Object.freeze({
      ...extra,
      signal: controller.signal,
      client: Object.freeze({ address: '192.0.2.7' }),
      annotate: (name: string, value: string | number | boolean) => void annotations.push([name, value]),
      report: (code: string, error: unknown) => void reports.push([code, error]),
    }),
    annotations,
    reports,
    abort: () => controller.abort(),
  }
}

const request = Object.freeze({
  method: 'GET',
  url: '/reports/7',
  headers: Object.freeze(Object.create(null)),
  path: '/reports/7',
  params: Object.freeze(Object.create(null)),
}) as unknown as ServiceRequest

/**
 * Builds a small valid response.
 *
 * @param text - The body text.
 * @returns A 200 response with no headers.
 */
const answer = (text: string): ServiceResponse => ({ status: 200, headers: {}, body: Buffer.from(text) })

/**
 * Stands in for `next`: every request of these specs matches the one route, so a call means the router delegated.
 *
 * @throws {Error} Always.
 */
const unreachable = (): never => {
  throw new Error('the router delegated')
}

/**
 * Builds a router with one route that has a deadline of 250 ms, and dispatches one request to it.
 *
 * @param handler - The route's handler.
 * @param probe - The request's context; a new one when omitted.
 * @returns The settled result, the fake clock, the context and the contexts the handler saw.
 */
const dispatch = (handler: Handler, probe: Probe = createProbe()): Dispatch => {
  const time = createClock()
  const received: StepContext[] = []
  const recording: Handler = (incoming, context) => (received.push(context), handler(incoming, context))
  const step: Step = router({ report: route('GET', '/reports/:id', recording, { timeoutMs: 250 }) }, undefined, { clock: time.clock })
  return { settled: settle(() => step(request, probe.context, unreachable), probe.context), time, probe, received }
}

describe('router deadline', () => {
  it('starts one timer of the route timeoutMs on the injected clock', async () => {
    const { settled, time } = dispatch(() => answer('ready'))
    await settled
    expect(time.timers.map((timer) => timer.ms)).toEqual([250])
  })

  it('returns the response of a handler that answers before the deadline, as the very object', async () => {
    const response = answer('ready')
    expect(await dispatch(() => response).settled).toBe(response)
  })

  it('clears the timer when the handler answers first', async () => {
    const { settled, time } = dispatch(async () => answer('ready'))
    await settled
    expect({ calls: time.calls, cleared: time.timers.map((timer) => timer.cleared) }).toEqual({
      calls: ['setTimeout', 'clearTimeout'],
      cleared: [true],
    })
  })

  it('carries the abort of the request signal to the handler signal after the handler answered', async () => {
    const { settled, probe, received } = dispatch(() => answer('ready'))
    await settled
    probe.abort()
    expect(received[0]?.signal.aborted).toBe(true)
  })

  it('tells a handler that returned a stream body of the end of its exchange', async () => {
    const told: string[] = []
    const { settled, probe } = dispatch((_request, context) => {
      context.signal.addEventListener('abort', () => told.push('aborted'))
      return { status: 200, headers: {}, body: new Readable({ read: () => undefined }) }
    })
    await settled
    probe.abort()
    expect(told).toEqual(['aborted'])
  })

  it('leaves the handler signal alone after the handler answered, for as long as the request signal has not aborted', async () => {
    const { settled, received } = dispatch(() => answer('ready'))
    await settled
    expect(received[0]?.signal.aborted).toBe(false)
  })

  it('keeps one listener on the request signal after the handler answered, which goes with that signal', async () => {
    const { settled, probe } = dispatch(() => answer('ready'))
    await settled
    expect(getEventListeners(probe.context.signal, 'abort')).toHaveLength(1)
  })

  it('leaves no listener on the request signal once that signal has aborted', async () => {
    const { settled, probe } = dispatch(() => answer('ready'))
    await settled
    probe.abort()
    expect(getEventListeners(probe.context.signal, 'abort')).toHaveLength(0)
  })

  it('leaves no listener on the request signal past the deadline', () => {
    const { time, probe } = dispatch(() => createDeferred<ServiceResponse>().promise)
    time.timers[0]?.fire()
    expect(getEventListeners(probe.context.signal, 'abort')).toHaveLength(0)
  })

  it('adds no listener to a request signal that has already aborted', () => {
    const probe = createProbe()
    probe.abort()
    dispatch(() => answer('ready'), probe)
    expect(getEventListeners(probe.context.signal, 'abort')).toHaveLength(0)
  })

  it('never reads the time', async () => {
    const { settled, time } = dispatch(() => answer('ready'))
    await settled
    expect(time.calls).not.toContain('now')
  })

  it('hands the handler a signal of its own', () => {
    const { probe, received } = dispatch(() => answer('ready'))
    expect(received[0]?.signal).not.toBe(probe.context.signal)
  })

  it('hands the handler a frozen context that keeps every other key', () => {
    const probe = createProbe({ tenant: 't1' })
    const { received } = dispatch(() => answer('ready'), probe)
    expect([Object.isFrozen(received[0]), { ...received[0] }]).toEqual([true, { ...probe.context, signal: received[0]?.signal }])
  })

  it('leaves the handler signal alone while the handler runs within its deadline', () => {
    const { received } = dispatch(() => createDeferred<ServiceResponse>().promise)
    expect(received[0]?.signal.aborted).toBe(false)
  })

  it('answers 503, annotated handler-timeout and reported nowhere, when the deadline passes first', async () => {
    const { settled, time, probe } = dispatch(() => createDeferred<ServiceResponse>().promise)
    time.timers[0]?.fire()
    const response = await settled
    expect({ status: response.status, body: response.body?.toString(), annotations: probe.annotations, reports: probe.reports }).toEqual({
      status: 503,
      body: 'Service Unavailable',
      annotations: [
        ['route', 'report'],
        ['failure', 'handler-timeout'],
      ],
      reports: [],
    })
  })

  it('aborts the handler signal at the deadline', () => {
    const { time, received } = dispatch(() => createDeferred<ServiceResponse>().promise)
    time.timers[0]?.fire()
    expect(received[0]?.signal.aborted).toBe(true)
  })

  it('does not abort the request signal at the deadline', () => {
    const { time, probe } = dispatch(() => createDeferred<ServiceResponse>().promise)
    time.timers[0]?.fire()
    expect(probe.context.signal.aborted).toBe(false)
  })

  it('releases a response that arrives after the deadline', async () => {
    const late = createDeferred<ServiceResponse>()
    const body = new Readable({ read: () => undefined })
    const { settled, time } = dispatch(() => late.promise)
    time.timers[0]?.fire()
    late.resolve({ status: 200, headers: {}, body })
    await settled
    await flushPromises()
    expect(body.destroyed).toBe(true)
  })

  it('still answers 503 when the response arrives after the deadline', async () => {
    const late = createDeferred<ServiceResponse>()
    const { settled, time } = dispatch(() => late.promise)
    time.timers[0]?.fire()
    late.resolve(answer('late'))
    expect((await settled).status).toBe(503)
  })

  it('drops a rejection that arrives after the deadline', async () => {
    const late = createDeferred<ServiceResponse>()
    const { settled, time, probe } = dispatch(() => late.promise)
    time.timers[0]?.fire()
    late.reject(new Error('the handler failed late'))
    const response = await settled
    await flushPromises()
    expect({ status: response.status, reports: probe.reports }).toEqual({ status: 503, reports: [] })
  })

  it('leaves a stream body of a handler that answers in time alone', async () => {
    const body = new Readable({ read: () => undefined })
    const { settled } = dispatch(() => ({ status: 200, headers: {}, body }))
    await settled
    expect(body.destroyed).toBe(false)
  })

  it('carries the abort of the request signal to the handler signal', () => {
    const { probe, received } = dispatch(() => createDeferred<ServiceResponse>().promise)
    probe.abort()
    expect(received[0]?.signal.aborted).toBe(true)
  })

  it('aborts the handler signal at once for a request signal that has already aborted', () => {
    const probe = createProbe()
    probe.abort()
    const seen: boolean[] = []
    dispatch((_request, context) => (seen.push(context.signal.aborted), answer('ready')), probe)
    expect(seen).toEqual([true])
  })

  it('clears the timer when the request signal aborts while the handler is still running', () => {
    const { time, probe } = dispatch(() => createDeferred<ServiceResponse>().promise)
    probe.abort()
    expect({ calls: time.calls, cleared: time.timers.map((timer) => timer.cleared) }).toEqual({
      calls: ['setTimeout', 'clearTimeout'],
      cleared: [true],
    })
  })

  it('clears the timer at once for a request signal that has already aborted', () => {
    const probe = createProbe()
    probe.abort()
    const { time } = dispatch(() => createDeferred<ServiceResponse>().promise, probe)
    expect({ calls: time.calls, cleared: time.timers.map((timer) => timer.cleared) }).toEqual({
      calls: ['setTimeout', 'clearTimeout'],
      cleared: [true],
    })
  })

  it('clears the timer once when the handler answers after the request signal aborted', async () => {
    const pending = createDeferred<ServiceResponse>()
    const { settled, time, probe } = dispatch(() => pending.promise)
    probe.abort()
    pending.resolve(answer('ready'))
    await settled
    expect(time.calls).toEqual(['setTimeout', 'clearTimeout'])
  })

  it('clears the timer once when the handler rejects after the request signal aborted', async () => {
    const pending = createDeferred<ServiceResponse>()
    const { settled, time, probe } = dispatch(() => pending.promise)
    probe.abort()
    pending.reject(new Error('the handler failed'))
    await settled
    expect(time.calls).toEqual(['setTimeout', 'clearTimeout'])
  })

  it('returns a response that arrives after the request signal aborted', async () => {
    const pending = createDeferred<ServiceResponse>()
    const response = answer('ready')
    const { settled, probe } = dispatch(() => pending.promise)
    probe.abort()
    pending.resolve(response)
    expect(await settled).toBe(response)
  })

  it('lets a throw of the handler before the deadline be its own failure', async () => {
    const { settled, probe } = dispatch(() => {
      throw new TypeError('the handler failed')
    })
    const response = await settled
    expect({ status: response.status, annotations: probe.annotations, reports: probe.reports }).toEqual({
      status: 500,
      annotations: [
        ['route', 'report'],
        ['failure', 'internal'],
      ],
      reports: [['step-failed', new TypeError('the handler failed')]],
    })
  })

  it('clears the timer when the handler throws before the deadline', async () => {
    const { settled, time } = dispatch(() => {
      throw new Error('the handler failed')
    })
    await settled
    expect(time.calls).toEqual(['setTimeout', 'clearTimeout'])
  })

  it('lets a rejection of the handler before the deadline be its own failure', async () => {
    const { settled, probe } = dispatch(() => Promise.reject(new RangeError('the handler failed')))
    await settled
    expect(probe.reports).toEqual([['step-failed', new RangeError('the handler failed')]])
  })

  it('clears the timer when the handler rejects before the deadline', async () => {
    const { settled, time } = dispatch(() => Promise.reject(new Error('the handler failed')))
    await settled
    expect(time.calls).toEqual(['setTimeout', 'clearTimeout'])
  })

  it('carries the abort of the request signal to the handler signal after the handler rejected', async () => {
    const { settled, probe, received } = dispatch(() => Promise.reject(new Error('the handler failed')))
    await settled
    probe.abort()
    expect(received[0]?.signal.aborted).toBe(true)
  })

  it('touches no clock for a route without timeoutMs', async () => {
    const time = createClock()
    const probe = createProbe()
    const step = router({ report: route('GET', '/reports/:id', () => answer('ready')) }, undefined, { clock: time.clock })
    await settle(() => step(request, probe.context, unreachable), probe.context)
    expect(time.calls).toEqual([])
  })

  it('touches no clock while it builds a table with a deadline', () => {
    const time = createClock()
    router({ report: route('GET', '/reports/:id', () => answer('ready'), { timeoutMs: 250 }) }, undefined, { clock: time.clock })
    expect(time.calls).toEqual([])
  })

  it('keeps time on the system clock when none is injected', async () => {
    const probe = createProbe()
    // why: one millisecond of real time is the longest this timer can stay pending, whatever the outcome of the test
    const step = router({ report: route('GET', '/reports/:id', () => createDeferred<ServiceResponse>().promise, { timeoutMs: 1 }) })
    expect((await settle(() => step(request, probe.context, unreachable), probe.context)).status).toBe(503)
  })

  it('keeps time on the system clock when the deps name no clock', async () => {
    const probe = createProbe()
    const step = router({ report: route('GET', '/reports/:id', () => createDeferred<ServiceResponse>().promise, { timeoutMs: 1 }) }, {}, {})
    expect((await settle(() => step(request, probe.context, unreachable), probe.context)).status).toBe(503)
  })
})
