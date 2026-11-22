import type { ServiceClock } from './clock'
import type { RequestEvent } from './events'
import type { ProcessOutput, RunContext, RunDeps, ServiceDefinition, StartedService } from './run'
import { EventEmitter } from 'node:events'
import { createDeferred, describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { defineEnvironment, optional, required } from '../environment/contract'
import { asPort, asText } from '../environment/readers'
import { defineService, processOf, runService } from './run'

const MARKER = 'not-a-port-marker'
const EVENT: RequestEvent = {
  type: 'request',
  method: 'GET',
  route: 'hello',
  path: null,
  status: 200,
  outcome: 'sent',
  durationMs: 3,
  annotations: {},
}
const EVENT_LINE = 'request method=GET route=hello status=200 outcome=sent ms=3\n'
const UNUSABLE_BLOCK =
  'fatal cause=start-failed name=TypeError\nthe start function must resolve to an object with a close() function and, when it has a port, an integer from 1 to 65535.\n'

/** The fake process: it records what the runner writes and asks, and a spec emits its events. */
interface FakeProcess extends EventEmitter {
  /** The environment the contract is checked against. */
  env: Record<string, string | undefined>
  /** The platform name. */
  platform: string
  /** Everything written to standard output, in order. */
  out: string
  /** Everything written to standard error, in order. */
  err: string
  /** Every code `exit` was called with. */
  exits: number[]
  /** Standard output. */
  stdout: ProcessOutput
  /** Standard error. */
  stderr: ProcessOutput
  /** Records the code instead of ending anything. */
  exit(code: number): void
}

/** One timer of the fake clock. */
interface FakeTimer {
  /** The delay it was started with. */
  readonly ms: number
  /** The reading of the clock at which it fires. */
  readonly at: number
  /** What it runs. */
  readonly fire: () => void
}

/** The fake clock: time moves only when a spec advances it. */
interface FakeClock extends ServiceClock {
  /** The timers that are pending. */
  timers: FakeTimer[]
  /** How many times a timer was cancelled that was not pending: one that had fired, or one cancelled before. */
  stale: number
  /** Moves time forward and fires what came due. */
  advance(ms: number): void
  /** The delays of the pending timers. */
  delays(): number[]
}

/** One run over the fakes. */
interface Run {
  /** The fake process. */
  readonly proc: FakeProcess
  /** The fake clock. */
  readonly clock: FakeClock
  /** The promise `runService` returned. */
  readonly code: Promise<number>
}

/** A start function's promise, settled by the spec. */
interface PendingStart {
  /** The start function to put in a definition. */
  readonly start: () => Promise<StartedService>
  /** Resolves the start. */
  resolve(value: unknown): void
  /** Rejects the start. */
  reject(error: unknown): void
}

/**
 * Builds a fake process.
 *
 * @param env - The environment it carries.
 * @param platform - The platform it names.
 * @returns An event emitter with the members the runner uses, whose streams call back at once.
 */
const fakeProcess = (env: Record<string, string | undefined> = {}, platform = 'linux'): FakeProcess => {
  const proc: FakeProcess = Object.assign(new EventEmitter(), {
    env,
    platform,
    out: '',
    err: '',
    exits: [] as number[],
    stdout: { write: (text: string, done?: () => void) => ((proc.out += text), done?.()) },
    stderr: { write: (text: string, done?: () => void) => ((proc.err += text), done?.()) },
    exit: (code: number) => void proc.exits.push(code),
  })
  return proc
}

/**
 * Builds a fake clock that starts at zero.
 *
 * @returns The clock and its pending timers.
 */
const fakeClock = (): FakeClock => {
  let time = 0
  const clock: FakeClock = {
    timers: [],
    stale: 0,
    now: () => time,
    setTimeout: (fire, ms) => {
      const timer = { ms, at: time + ms, fire }
      clock.timers.push(timer)
      return timer
    },
    clearTimeout: (handle) => {
      clock.stale += clock.timers.includes(handle as FakeTimer) ? 0 : 1
      clock.timers = clock.timers.filter((timer) => timer !== handle)
    },
    advance: (ms) => {
      time += ms
      const due = clock.timers.filter((timer) => timer.at <= time)
      clock.timers = clock.timers.filter((timer) => timer.at > time)
      due.forEach((timer) => timer.fire())
    },
    delays: () => clock.timers.map((timer) => timer.ms),
  }
  return clock
}

/**
 * Builds a definition that boots: no variable, and a start that resolves a listener on port 8080.
 *
 * @param members - What the case replaces or adds.
 * @returns The definition, typed loosely enough for a case to break it.
 */
const service = (members: Record<string, unknown> = {}): ServiceDefinition<Record<string, never>> =>
  ({
    environment: { variables: [], check: () => [], load: () => ({}) },
    start: () => ({ port: 8080, close: async () => undefined }),
    ...members,
  }) as unknown as ServiceDefinition<Record<string, never>>

/**
 * Runs a definition over fakes, from source unless the case says otherwise, and lets its start settle.
 *
 * @param members - What the case replaces or adds in the definition.
 * @param proc - The fake process to run on.
 * @param deps - Boundaries the case replaces.
 * @returns The fakes and the promise for the exit code.
 */
const run = async (members: Record<string, unknown> = {}, proc: FakeProcess = fakeProcess(), deps: RunDeps = {}): Promise<Run> => {
  const clock = fakeClock()
  const code = runService(service(members), { process: proc, clock, build: null, ...deps })
  await flushPromises()
  return { proc, clock, code }
}

/**
 * Builds a start function whose promise the spec settles.
 *
 * @returns The function and the two ways to settle it.
 */
const pendingStart = (): PendingStart => {
  const deferred = createDeferred<StartedService>()
  return { start: () => deferred.promise, resolve: (value) => deferred.resolve(value as StartedService), reject: deferred.reject }
}

/**
 * Stands in for a start that never settles.
 *
 * @returns A promise that stays pending.
 */
const never = (): Promise<StartedService> => new Promise<StartedService>(() => undefined)

/**
 * Raises a fixed error for a getter that must not be read.
 */
const refuse = (): never => {
  throw new Error('a getter that throws')
}

describe('runService', () => {
  describe('definition', () => {
    it('writes every problem of a faulty definition as one block', async () => {
      const { proc } = await run({ start: 'listen', stopTimeoutMs: 0 })
      expect(proc.err).toBe('fatal cause=definition\n  - "start" must be a function.\n  - "stopTimeoutMs" must be a positive integer.\n')
    })

    it('exits 1 for a faulty definition', async () => {
      const { proc, code } = await run({ start: 'listen' })
      expect({ exits: proc.exits, code: await code }).toEqual({ exits: [1], code: 1 })
    })

    it('adds no listener for a faulty definition', async () => {
      const proc = fakeProcess()
      const added: string[] = []
      proc.on('newListener', (event: string) => void added.push(event))
      await run({ start: 'listen' }, proc)
      expect(added).toEqual([])
    })

    it.each(['immutable', 'environment', 'start', 'stopTimeoutMs'])('resolves 1 when the %s getter throws', async (name) => {
      const proc = fakeProcess()
      const definition = Object.defineProperty(service(), name, { get: refuse })
      expect(await runService(definition, { process: proc, clock: fakeClock(), build: null })).toBe(1)
    })

    it('writes a getter that throws as a block with the name of the error and no message', async () => {
      const proc = fakeProcess()
      await runService(Object.defineProperty(service(), 'immutable', { get: refuse }), { process: proc, clock: fakeClock(), build: null })
      expect(proc.err).toBe('fatal cause=definition name=Error\n')
    })

    it('adds no listener for a definition whose getter throws', async () => {
      const proc = fakeProcess()
      const added: string[] = []
      proc.on('newListener', (event: string) => void added.push(event))
      await runService(Object.defineProperty(service(), 'immutable', { get: refuse }), { process: proc, clock: fakeClock(), build: null })
      expect(added).toEqual([])
    })

    it('reads the stop time once, so a getter that throws on a later read stops nothing from ending', async () => {
      const reads: number[] = []
      const definition = Object.defineProperty(service(), 'stopTimeoutMs', { get: () => (reads.push(1), 50) })
      const proc = fakeProcess()
      const code = runService(definition, { process: proc, clock: fakeClock(), build: null })
      await flushPromises()
      proc.emit('SIGTERM')
      await code
      expect(reads).toEqual([1])
    })

    it('refuses a definition that is no object, on the default clock', async () => {
      const proc = fakeProcess()
      await runService(null as unknown as ServiceDefinition<Record<string, never>>, { process: proc })
      expect(proc.err).toBe('fatal cause=definition\n  - the definition must be an object.\n')
    })
  })

  describe('listeners', () => {
    it('adds five on a POSIX platform', async () => {
      const { proc } = await run()
      expect(proc.eventNames()).toEqual(['SIGINT', 'SIGTERM', 'disconnect', 'uncaughtException', 'unhandledRejection'])
    })

    it('adds six on win32, the one for SIGBREAK among them', async () => {
      const { proc } = await run({}, fakeProcess({}, 'win32'))
      expect(proc.eventNames()).toEqual(['SIGINT', 'SIGTERM', 'SIGBREAK', 'disconnect', 'uncaughtException', 'unhandledRejection'])
    })

    it('adds five on macOS, where SIGBREAK is not listened to either', async () => {
      const { proc } = await run({}, fakeProcess({}, 'darwin'))
      expect(proc.eventNames()).toEqual(['SIGINT', 'SIGTERM', 'disconnect', 'uncaughtException', 'unhandledRejection'])
    })

    it('adds one listener per event', async () => {
      const { proc } = await run()
      expect(proc.eventNames().map((event) => proc.listenerCount(event))).toEqual([1, 1, 1, 1, 1])
    })

    it('leaves none after a boot that was refused', async () => {
      const { proc } = await run({ start: () => Promise.reject(new Error('no')) })
      expect(proc.eventNames()).toEqual([])
    })
  })

  describe('order', () => {
    it('never calls start when the environment has an issue', async () => {
      const calls: string[] = []
      const environment = {
        check: () => [{ name: 'PORT', group: 'http', problem: 'missing', expected: 'a port' }],
        load: () => void calls.push('load'),
      }
      await run({ environment, start: () => void calls.push('start') })
      expect(calls).toEqual([])
    })

    it('checks the environment of the process it was given, then loads it', async () => {
      const calls: unknown[][] = []
      const environment = {
        check: (env: unknown) => (calls.push(['check', env]), []),
        load: (env: unknown) => (calls.push(['load', env]), {}),
      }
      const { proc } = await run({ environment })
      expect(calls).toEqual([
        ['check', proc.env],
        ['load', proc.env],
      ])
    })

    it('calls start once, with the loaded values', async () => {
      const given: unknown[] = []
      const values = { http: { PORT: 8080 } }
      await run({
        environment: { check: () => [], load: () => values },
        start: (loaded: unknown) => (given.push(loaded), { close: async () => undefined }),
      })
      expect(given).toEqual([values])
    })

    it('hands start a frozen context of a signal and a report function', async () => {
      const contexts: RunContext[] = []
      await run({ start: (_values: unknown, context: RunContext) => (contexts.push(context), { close: async () => undefined }) })
      expect({
        frozen: Object.isFrozen(contexts[0]),
        members: Object.keys(contexts[0]),
        aborted: contexts[0].signal.aborted,
        report: typeof contexts[0].report,
      }).toEqual({ frozen: true, members: ['signal', 'report'], aborted: false, report: 'function' })
    })
  })

  describe('environment', () => {
    const contract = defineEnvironment({
      http: { PORT: optional(asPort({ allowZero: true }), 8080) },
      hello: { HELLO_GREETING: required(asText()) },
    })

    it('writes one line per issue, from the issues and not from a message', async () => {
      const { proc } = await run({ environment: contract }, fakeProcess({ PORT: MARKER }))
      expect(proc.err).toBe(
        'fatal cause=environment\n  - PORT (http) is malformed; expected an integer between 0 and 65535.\n  - HELLO_GREETING (hello) is missing; expected non-empty text.\n'
      )
    })

    it('exits 78 and prints no started line', async () => {
      const { proc, code } = await run({ environment: contract }, fakeProcess({ PORT: MARKER }))
      expect({ code: await code, exits: proc.exits, out: proc.out }).toEqual({ code: 78, exits: [78], out: '' })
    })

    it('keeps a malformed value out of both streams', async () => {
      const { proc } = await run({ environment: contract }, fakeProcess({ PORT: MARKER }))
      expect(`${proc.out}${proc.err}`).not.toContain(MARKER)
    })

    it('hands start the values of a real contract', async () => {
      const given: unknown[] = []
      const start = (values: unknown): StartedService => (given.push(values), { close: async () => undefined })
      await run({ environment: contract, start }, fakeProcess({ HELLO_GREETING: 'Hello' }))
      expect(given).toEqual([{ http: { PORT: 8080 }, hello: { HELLO_GREETING: 'Hello' } }])
    })

    it('reports a check that throws by its name alone', async () => {
      const check = (): never => {
        throw new RangeError(`cannot check ${MARKER}`)
      }
      const { proc } = await run({ environment: { check, load: () => ({}) } })
      expect(proc.err).toBe('fatal cause=environment name=RangeError\n')
    })

    it('reports a load that throws by its name alone, with exit 78', async () => {
      const load = (): never => {
        throw Object.assign(new TypeError(`cannot load ${MARKER}`), { code: 'E_LOAD' })
      }
      const { proc } = await run({ environment: { check: () => [], load } })
      expect({ err: proc.err, exits: proc.exits }).toEqual({ err: 'fatal cause=environment name=TypeError\n', exits: [78] })
    })
  })

  describe('start', () => {
    it('prints the started line with the port of what it resolved', async () => {
      const { proc } = await run()
      expect(proc.out).toBe('started port=8080\n')
    })

    it('prints the bare started line for a service with no port', async () => {
      const { proc } = await run({ start: async () => ({ close: async () => undefined }) })
      expect(proc.out).toBe('started\n')
    })

    it('neither exits nor writes an error once started', async () => {
      const { proc } = await run()
      expect({ exits: proc.exits, err: proc.err }).toEqual({ exits: [], err: '' })
    })

    it('prints the name, the code, the message and the frames of a rejection', async () => {
      const error = Object.assign(new RangeError('Invalid service options:\n  - "port" must be an integer.'), { code: 'ERR_OUT_OF_RANGE' })
      const { proc } = await run({ start: () => Promise.reject(error) })
      expect(proc.err).toMatch(
        /^fatal cause=start-failed name=RangeError code=ERR_OUT_OF_RANGE\nInvalid service options:\n {2}- "port" must be an integer\.\n {4}at \S/
      )
    })

    it('exits 1 after a rejection, with no started line', async () => {
      const { proc, code } = await run({ start: () => Promise.reject(new Error('no')) })
      expect({ code: await code, exits: proc.exits, out: proc.out }).toEqual({ code: 1, exits: [1], out: '' })
    })

    it('treats a synchronous throw as a rejection', async () => {
      const start = (): never => {
        throw new TypeError('thrown before any promise')
      }
      const { proc } = await run({ start })
      expect(proc.err).toMatch(/^fatal cause=start-failed name=TypeError\nthrown before any promise\n {4}at \S/)
    })

    it('prints nothing of a rejection that is no error', async () => {
      const { proc } = await run({ start: () => Promise.reject(MARKER) })
      expect(proc.err).toBe('fatal cause=start-failed name=unknown\n')
    })

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an object with no close', {}],
      ['a close that is no function', { close: 'now' }],
      ['a port of 0', { port: 0, close: async () => undefined }],
      ['a port of 65536', { port: 65536, close: async () => undefined }],
      ['a port that is no integer', { port: 80.5, close: async () => undefined }],
      ['a port that is text', { port: '8080', close: async () => undefined }],
      ['a function that carries a close', Object.assign(() => undefined, { close: async () => undefined })],
      ['a value whose close cannot be read', Object.defineProperty({}, 'close', { get: refuse })],
    ])('writes the fixed block for a start that resolves %s', async (_name, value) => {
      const { proc } = await run({ start: async () => value })
      expect(proc.err).toBe(UNUSABLE_BLOCK)
    })

    it('exits 1 for a start that resolves something it cannot stop', async () => {
      const { proc } = await run({ start: async () => ({}) })
      expect(proc.exits).toEqual([1])
    })

    it.each([1, 65535])('takes the port %d', async (port) => {
      const { proc } = await run({ start: async () => ({ port, close: async () => undefined }) })
      expect(proc.out).toBe(`started port=${port}\n`)
    })

    it('does nothing one millisecond before the default start time', async () => {
      const { proc, clock } = await run({ start: never })
      clock.advance(29999)
      expect({ out: proc.out, err: proc.err, exits: proc.exits }).toEqual({ out: '', err: '', exits: [] })
    })

    it('begins a stop at the default start time, without exiting', async () => {
      const signals: AbortSignal[] = []
      const { proc, clock } = await run({ start: (_values: unknown, context: RunContext) => (signals.push(context.signal), never()) })
      clock.advance(30000)
      expect({ err: proc.err, out: proc.out, aborted: signals[0].aborted, exits: proc.exits }).toEqual({
        err: 'fatal cause=start-timeout\n',
        out: 'stopping cause=start-timeout\n',
        aborted: true,
        exits: [],
      })
    })

    it('closes a usable value that arrives after the start time, with exit 1 and no started line', async () => {
      const pending = pendingStart()
      const closed: string[] = []
      const { proc, clock, code } = await run({ start: pending.start })
      clock.advance(30000)
      pending.resolve({ port: 8080, close: async () => void closed.push('closed') })
      expect({ code: await code, closed, out: proc.out, err: proc.err }).toEqual({
        code: 1,
        closed: ['closed'],
        out: 'stopping cause=start-timeout\nstopped\n',
        err: 'fatal cause=start-timeout\n',
      })
    })

    it('exits 1 with no second block for a rejection that arrives after the start time', async () => {
      const pending = pendingStart()
      const { proc, clock, code } = await run({ start: pending.start })
      clock.advance(30000)
      pending.reject(new Error(MARKER))
      expect({ code: await code, err: proc.err }).toEqual({ code: 1, err: 'fatal cause=start-timeout\n' })
    })

    it('ends with a stop timeout one stop time after a start that never settles ran out of time', async () => {
      const { proc, clock, code } = await run({ start: never })
      clock.advance(30000)
      clock.advance(14999)
      const before = [...proc.exits]
      clock.advance(1)
      expect({ before, code: await code, err: proc.err }).toEqual({
        before: [],
        code: 1,
        err: 'fatal cause=start-timeout\nfatal cause=stop-timeout\n',
      })
    })
  })

  describe('hold', () => {
    it('keeps one timer of the longest delay pending after the started line', async () => {
      const { clock } = await run()
      expect(clock.delays()).toEqual([2147483647])
    })

    it('arms the timer again when it fires, and writes nothing', async () => {
      const { proc, clock } = await run()
      clock.advance(2147483647)
      expect({ delays: clock.delays(), out: proc.out, err: proc.err, exits: proc.exits }).toEqual({
        delays: [2147483647],
        out: 'started port=8080\n',
        err: '',
        exits: [],
      })
    })

    it('keeps none but the start timer while booting', async () => {
      const { clock } = await run({ start: never })
      expect(clock.delays()).toEqual([30000])
    })

    it('keeps none but the stop timer once a stop began', async () => {
      const { proc, clock } = await run({ start: async () => ({ close: never }) })
      proc.emit('SIGTERM')
      expect(clock.delays()).toEqual([15000])
    })

    it('leaves none after the exit', async () => {
      const { proc, clock, code } = await run()
      proc.emit('SIGTERM')
      await code
      expect(clock.delays()).toEqual([])
    })

    it('leaves none after a boot that was refused', async () => {
      const { clock } = await run({ start: 'listen' })
      expect(clock.delays()).toEqual([])
    })

    it('never cancels a timer that is not pending, from the start to the exit', async () => {
      const { proc, clock, code } = await run()
      clock.advance(2147483647)
      clock.advance(2147483647)
      proc.emit('SIGTERM')
      await code
      expect(clock.stale).toBe(0)
    })

    it('never cancels the flush deadline once it fired', async () => {
      const proc = fakeProcess()
      proc.stdout = { write: (text: string) => void (proc.out += text) }
      const { clock, code } = await run({ start: 'listen' }, proc)
      clock.advance(2000)
      await code
      expect(clock.stale).toBe(0)
    })
  })

  describe('report', () => {
    /**
     * Runs a service that keeps the context its start was given.
     *
     * @param proc - The fake process to run on.
     * @returns The run and the context.
     */
    const reporting = async (proc: FakeProcess = fakeProcess()): Promise<Run & { readonly context: RunContext }> => {
      const contexts: RunContext[] = []
      const started = await run(
        { start: (_values: unknown, context: RunContext) => (contexts.push(context), { port: 8080, close: async () => undefined }) },
        proc
      )
      return { ...started, context: contexts[0] }
    }

    it('writes an event as one line on standard output', async () => {
      const { proc, context } = await reporting()
      context.report(EVENT)
      expect(proc.out).toBe(`started port=8080\n${EVENT_LINE}`)
    })

    it('swallows a write that throws', async () => {
      const { proc, context } = await reporting()
      proc.stdout = {
        write: () => {
          throw new Error('EPIPE')
        },
      }
      expect(() => context.report(EVENT)).not.toThrow()
    })

    it('swallows an event that cannot be formatted', async () => {
      const { context } = await reporting()
      expect(() => context.report(null as unknown as RequestEvent)).not.toThrow()
    })

    it('writes nothing once the exit began', async () => {
      const proc = fakeProcess()
      const { context } = await reporting(proc)
      proc.stdout = { write: (text: string) => void (proc.out += text) }
      proc.emit('SIGTERM')
      await flushPromises()
      context.report(EVENT)
      expect(proc.out).toBe('started port=8080\nstopping cause=signal signal=SIGTERM\nstopped\n')
    })
  })

  describe('defaults', () => {
    it('acts on the global process when none is given', () => {
      expect(processOf({})).toBe(process)
    })

    it('acts on the process it is given', () => {
      const proc = fakeProcess()
      expect(processOf({ process: proc })).toBe(proc)
    })

    it('gives a start the time its definition names', async () => {
      const { clock } = await run({ start: never, startTimeoutMs: 50 })
      expect(clock.delays()).toEqual([50])
    })

    it('gives a stop the time its definition names', async () => {
      const { proc, clock } = await run({ start: async () => ({ close: never }), stopTimeoutMs: 70 })
      proc.emit('SIGTERM')
      expect(clock.delays()).toEqual([70])
    })
  })
})

describe('defineService', () => {
  it('returns the definition it was given', () => {
    const definition = service()
    expect(defineService(definition)).toBe(definition)
  })

  it('freezes neither the definition nor its immutable section', () => {
    const definition = defineService(service({ immutable: { greeting: 'Hello' } }))
    expect([Object.isFrozen(definition), Object.isFrozen(definition.immutable)]).toEqual([false, false])
  })
})
