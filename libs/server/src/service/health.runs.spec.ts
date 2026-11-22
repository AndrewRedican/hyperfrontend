import type { Deferred } from '@hyperfrontend/testing'
import type { ServiceClock } from './clock'
import type { BaseContext, ServiceRequest, ServiceResponse, Step } from './contract'
import { createDeferred, describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { readiness } from './health'
import { settle } from './pipeline'

/** One timer a fake clock was asked for. */
interface FakeTimer {
  /** The delay asked for. */
  readonly ms: number
  /** Whether the timer was taken back. */
  cleared: boolean
  /** Runs the timer's callback, as the clock would at the timeout. */
  fire(): void
}

/** A clock that keeps its timers for the spec to fire. */
interface FakeClock {
  /** The clock handed to the step. */
  readonly clock: ServiceClock
  /** Every timer started, in order. */
  readonly timers: FakeTimer[]
  /** The name of every clock method called, in order. */
  readonly calls: string[]
}

/** A context that records what is reported to it. */
interface Probe {
  /** The context handed to the step. */
  readonly context: BaseContext
  /** Every `report` call, in order. */
  readonly reports: unknown[][]
  /** Aborts the request's signal, as a client leaving does. */
  abort(): void
}

/** A check whose every run the spec settles by hand. */
interface ManualCheck {
  /** The check handed to the step. */
  readonly check: (signal: AbortSignal) => Promise<boolean>
  /** One pending result per run, in the order the runs started. */
  readonly runs: Deferred<boolean>[]
  /** The signal each run received, in the same order. */
  readonly signals: AbortSignal[]
}

/** A readiness step over one manual check named `store`, and everything a spec drives it with. */
interface Fixture {
  /** The fake clock the step keeps time on. */
  readonly time: FakeClock
  /** The check under the name `store`. */
  readonly store: ManualCheck
  /** Sends one probe and returns what it will be answered. */
  probe(context?: BaseContext): Promise<unknown>
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
 * Builds a frozen context that records its reports and whose signal the spec can abort.
 *
 * @returns The context and what it recorded.
 */
const createProbe = (): Probe => {
  const controller = new AbortController()
  const reports: unknown[][] = []
  return {
    context: Object.freeze({
      signal: controller.signal,
      client: Object.freeze({ address: '192.0.2.7' }),
      annotate: () => undefined,
      report: (code: string, error: unknown) => void reports.push([code, error]),
    }),
    reports,
    abort: () => controller.abort(),
  }
}

/**
 * Builds a check that stays pending until the spec settles its run.
 *
 * @returns The check, its pending runs and the signals they received.
 */
const createManualCheck = (): ManualCheck => {
  const runs: Deferred<boolean>[] = []
  const signals: AbortSignal[] = []
  return {
    runs,
    signals,
    check: (signal) => {
      const run = createDeferred<boolean>()
      runs.push(run)
      signals.push(signal)
      return run.promise
    },
  }
}

const request = Object.freeze({
  method: 'GET',
  url: '/readyz',
  headers: Object.freeze(Object.create(null)),
  path: '/readyz',
  params: Object.freeze(Object.create(null)),
}) as unknown as ServiceRequest

/**
 * Stands in for `next`: every request of these specs is a probe, so a call means the step delegated.
 *
 * @throws {Error} Always.
 */
const unreachable = (): never => {
  throw new Error('the step delegated')
}

/**
 * Sends one probe to a step and reads the answer down to its status and JSON document.
 *
 * @param step - What the probe is sent to.
 * @param context - The context of the probe's request.
 * @returns A promise for `[status, document]`.
 */
const probeWith = (step: Step, context: BaseContext): Promise<unknown> =>
  settle(() => step(request, context, unreachable), context).then((response: ServiceResponse) => [
    response.status,
    JSON.parse(String(response.body)),
  ])

/**
 * Builds a readiness step over one manual check, on a fake clock.
 *
 * @param timeoutMs - The time allowed to a run; the step's default when omitted.
 * @returns The clock, the check and a way to probe.
 */
const createFixture = (timeoutMs?: number): Fixture => {
  const time = createClock()
  const store = createManualCheck()
  const step = readiness({ checks: { store: store.check }, timeoutMs }, { clock: time.clock })
  return { time, store, probe: (context = createProbe().context) => probeWith(step, context) }
}

const READY = [200, { ready: true, checks: { store: true } }]
const NOT_READY = [503, { ready: false, checks: { store: false } }]

describe('readiness runs', () => {
  it('starts one timer of 2000 ms for a run when no timeoutMs is given', () => {
    const { time, probe } = createFixture()
    void probe()
    expect(time.timers.map((timer) => timer.ms)).toEqual([2000])
  })

  it('starts the timer with the timeoutMs given', () => {
    const { time, probe } = createFixture(750)
    void probe()
    expect(time.timers.map((timer) => timer.ms)).toEqual([750])
  })

  it('starts one timer per check', () => {
    const time = createClock()
    const step = readiness({ checks: { store: createManualCheck().check, queue: createManualCheck().check } }, { clock: time.clock })
    void probeWith(step, createProbe().context)
    expect(time.timers).toHaveLength(2)
  })

  it('never reads the time', async () => {
    const { time, store, probe } = createFixture()
    const answer = probe()
    store.runs[0]?.resolve(true)
    await answer
    expect(time.calls).not.toContain('now')
  })

  it('answers a probe with what its run resolved to', async () => {
    const { store, probe } = createFixture()
    const answer = probe()
    store.runs[0]?.resolve(true)
    expect(await answer).toEqual(READY)
  })

  it('clears the timer when a run settles first', async () => {
    const { time, store, probe } = createFixture()
    const answer = probe()
    store.runs[0]?.resolve(true)
    await answer
    expect({ calls: time.calls, cleared: time.timers.map((timer) => timer.cleared) }).toEqual({
      calls: ['setTimeout', 'clearTimeout'],
      cleared: [true],
    })
  })

  it('clears the timer when a run rejects first', async () => {
    const { time, store, probe } = createFixture()
    const answer = probe()
    store.runs[0]?.reject(new Error('down'))
    await answer
    expect(time.timers.map((timer) => timer.cleared)).toEqual([true])
  })

  it('leaves the signal of a run that settled in time alone', async () => {
    const { store, probe } = createFixture()
    const answer = probe()
    store.runs[0]?.resolve(true)
    await answer
    expect(store.signals[0]?.aborted).toBe(false)
  })

  it('does not call a check again for a probe that arrives while its run is pending', () => {
    const { time, store, probe } = createFixture()
    void probe()
    void probe()
    void probe()
    expect({ runs: store.runs.length, timers: time.timers.length }).toEqual({ runs: 1, timers: 1 })
  })

  it('gives every probe that joined a run the result of that run', async () => {
    const { store, probe } = createFixture()
    const answers = [probe(), probe(), probe()]
    store.runs[0]?.resolve(true)
    expect(await Promise.all(answers)).toEqual([READY, READY, READY])
  })

  it('does not reuse a settled run for the next probe', async () => {
    const { store, probe } = createFixture()
    const first = probe()
    store.runs[0]?.resolve(true)
    await first
    const second = probe()
    store.runs[1]?.resolve(false)
    expect({ runs: store.runs.length, second: await second }).toEqual({ runs: 2, second: NOT_READY })
  })

  it('starts a new run after one that rejected', async () => {
    const { store, probe } = createFixture()
    const first = probe()
    store.runs[0]?.reject(new Error('down'))
    await first
    const second = probe()
    store.runs[1]?.resolve(true)
    expect(await second).toEqual(READY)
  })

  it('gives each run a signal of its own', async () => {
    const { store, probe } = createFixture()
    const first = probe()
    store.runs[0]?.resolve(true)
    await first
    void probe()
    expect(store.signals[1]).not.toBe(store.signals[0])
  })

  it('reports a rejected run once, on the context of the probe that started it', async () => {
    const { store, probe } = createFixture()
    const starter = createProbe()
    const joiner = createProbe()
    const fault = new Error('down')
    const answers = [probe(starter.context), probe(joiner.context)]
    store.runs[0]?.reject(fault)
    await Promise.all(answers)
    expect({ starter: starter.reports, joiner: joiner.reports }).toEqual({ starter: [['readiness-check-failed', fault]], joiner: [] })
  })

  it('answers every probe that joined a rejected run as not ready', async () => {
    const { store, probe } = createFixture()
    const answers = [probe(), probe()]
    store.runs[0]?.reject(new Error('down'))
    expect(await Promise.all(answers)).toEqual([NOT_READY, NOT_READY])
  })

  it('answers a probe whose check is slow as not ready at the timeout', async () => {
    const { time, probe } = createFixture()
    const answer = probe()
    time.timers[0]?.fire()
    expect(await answer).toEqual(NOT_READY)
  })

  it('aborts the signal of a run at its timeout', () => {
    const { time, store, probe } = createFixture()
    void probe()
    time.timers[0]?.fire()
    expect(store.signals[0]?.aborted).toBe(true)
  })

  it('reports nothing for a run that timed out', async () => {
    const { time, probe } = createFixture()
    const starter = createProbe()
    const answer = probe(starter.context)
    time.timers[0]?.fire()
    await answer
    expect(starter.reports).toEqual([])
  })

  it('answers every probe that joined a run as not ready when the run times out', async () => {
    const { time, probe } = createFixture()
    const answers = [probe(), probe()]
    time.timers[0]?.fire()
    expect(await Promise.all(answers)).toEqual([NOT_READY, NOT_READY])
  })

  it('answers not ready, without calling the check again, while a timed-out run has not settled', async () => {
    const { time, store, probe } = createFixture()
    const first = probe()
    time.timers[0]?.fire()
    await first
    expect({ later: [await probe(), await probe()], runs: store.runs.length, timers: time.timers.length }).toEqual({
      later: [NOT_READY, NOT_READY],
      runs: 1,
      timers: 1,
    })
  })

  it('calls the check again for the next probe once a timed-out run has resolved', async () => {
    const { time, store, probe } = createFixture()
    const first = probe()
    time.timers[0]?.fire()
    await first
    store.runs[0]?.resolve(true)
    await flushPromises()
    const second = probe()
    store.runs[1]?.resolve(true)
    expect({ runs: store.runs.length, second: await second }).toEqual({ runs: 2, second: READY })
  })

  it('calls the check again for the next probe once a timed-out run has rejected', async () => {
    const { time, store, probe } = createFixture()
    const first = probe()
    time.timers[0]?.fire()
    await first
    store.runs[0]?.reject(new Error('down at last'))
    await flushPromises()
    void probe()
    expect(store.runs).toHaveLength(2)
  })

  it('ignores the value a timed-out run resolves with at last', async () => {
    const { time, store, probe } = createFixture()
    const answers = [probe(), probe()]
    time.timers[0]?.fire()
    store.runs[0]?.resolve(true)
    expect(await Promise.all(answers)).toEqual([NOT_READY, NOT_READY])
  })

  it('does not report the late rejection of a timed-out run', async () => {
    const { time, store, probe } = createFixture()
    const starter = createProbe()
    const answer = probe(starter.context)
    time.timers[0]?.fire()
    await answer
    store.runs[0]?.reject(new Error('down at last'))
    await flushPromises()
    expect(starter.reports).toEqual([])
  })

  it('does not take back a timer that has fired when its run settles at last', async () => {
    const { time, store, probe } = createFixture()
    const answer = probe()
    time.timers[0]?.fire()
    await answer
    store.runs[0]?.resolve(true)
    await flushPromises()
    expect(time.calls).toEqual(['setTimeout'])
  })

  it('does not abort a run when the request of the probe that started it aborts', async () => {
    const { store, probe } = createFixture()
    const starter = createProbe()
    void probe(starter.context)
    const joined = probe()
    starter.abort()
    store.runs[0]?.resolve(true)
    expect({ aborted: store.signals[0]?.aborted, joined: await joined }).toEqual({ aborted: false, joined: READY })
  })

  it('still reports a rejected run when the request of the probe that started it has aborted', async () => {
    const { store, probe } = createFixture()
    const starter = createProbe()
    const fault = new Error('down')
    void probe(starter.context)
    const joined = probe()
    starter.abort()
    store.runs[0]?.reject(fault)
    await joined
    expect(starter.reports).toEqual([['readiness-check-failed', fault]])
  })

  it('keeps one run per check, so a check that hangs does not stop another from being asked again', async () => {
    const time = createClock()
    const store = createManualCheck()
    let asked = 0
    const step = readiness({ checks: { store: store.check, queue: () => (asked += 1) > 0 } }, { clock: time.clock })
    const first = probeWith(step, createProbe().context)
    time.timers[0]?.fire()
    await first
    expect({ second: await probeWith(step, createProbe().context), asked, runs: store.runs.length }).toEqual({
      second: [503, { ready: false, checks: { store: false, queue: true } }],
      asked: 2,
      runs: 1,
    })
  })

  it('answers when the last check settles, not at the first', async () => {
    const time = createClock()
    const store = createManualCheck()
    const queue = createManualCheck()
    const step = readiness({ checks: { store: store.check, queue: queue.check } }, { clock: time.clock })
    let answered = false
    const answer = probeWith(step, createProbe().context).then((value) => ((answered = true), value))
    store.runs[0]?.resolve(true)
    await flushPromises()
    const before = answered
    queue.runs[0]?.resolve(true)
    expect({ before, answer: await answer }).toEqual({
      before: false,
      answer: [200, { ready: true, checks: { store: true, queue: true } }],
    })
  })
})
