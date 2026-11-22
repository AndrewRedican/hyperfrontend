import type { ServiceClock } from './clock'
import type { ProcessOutput, RunContext, ServiceDefinition, StartedService } from './run'
import { EventEmitter } from 'node:events'
import { createDeferred, describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { runService } from './run'

const MARKER = 'message-marker'
const STARTED = 'started port=8080\n'

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

/** A fatal block, taken apart. */
interface Block {
  /** Its first line. */
  readonly head: string
  /** Whether at least one frame follows. */
  readonly framed: boolean
  /** The lines below the first that are no frames. */
  readonly others: readonly string[]
}

/** A promise a spec settles, and the function that hands it out. */
interface Pending<Value> {
  /** Hands out the promise, counting the calls. */
  readonly run: () => Promise<Value>
  /** How many times `run` was called. */
  calls: number
  /** Resolves the promise. */
  resolve(value: unknown): void
  /** Rejects the promise. */
  reject(error: unknown): void
}

/**
 * Builds a fake process.
 *
 * @param platform - The platform it names.
 * @returns An event emitter with the members the runner uses, whose streams call back at once.
 */
const fakeProcess = (platform = 'linux'): FakeProcess => {
  const proc: FakeProcess = Object.assign(new EventEmitter(), {
    env: {},
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
    now: () => time,
    setTimeout: (fire, ms) => {
      const timer = { ms, at: time + ms, fire }
      clock.timers.push(timer)
      return timer
    },
    clearTimeout: (handle) => {
      clock.timers = clock.timers.filter((timer) => timer !== handle)
    },
    advance: (ms) => {
      time += ms
      for (const timer of clock.timers.filter((candidate) => candidate.at <= time)) {
        clock.clearTimeout(timer)
        timer.fire()
      }
    },
    delays: () => clock.timers.map((timer) => timer.ms),
  }
  return clock
}

/**
 * Takes a fatal block apart, so that a case can say it holds frames and no line of a message.
 *
 * @param text - Everything written to standard error.
 * @returns The first line, whether a frame follows it, and every later line that is no frame; the last of those is the empty text after the final line feed.
 */
const blockOf = (text: string): Block => {
  const lines = text.split(/\r?\n/)
  return {
    head: lines[0],
    framed: lines.some((line) => line.startsWith('    at ')),
    others: lines.slice(1).filter((line) => !line.startsWith('    at ')),
  }
}

/**
 * Builds a promise the spec settles and a function that hands it out.
 *
 * @returns The function, its call count and the two ways to settle.
 */
const pending = <Value>(): Pending<Value> => {
  const deferred = createDeferred<Value>()
  const held: Pending<Value> = {
    calls: 0,
    run: () => {
      held.calls += 1
      return deferred.promise
    },
    resolve: (value) => deferred.resolve(value as Value),
    reject: deferred.reject,
  }
  return held
}

/**
 * Runs a service over fakes, from source, and lets its start settle.
 *
 * @param start - The start function; one that resolves a listener on port 8080 with the given close.
 * @param platform - The platform the fake process names.
 * @returns The fakes and the promise for the exit code.
 */
const run = async (start: unknown, platform = 'linux'): Promise<Run> => {
  const proc = fakeProcess(platform)
  const clock = fakeClock()
  const definition = { environment: { check: () => [], load: () => ({}) }, start } as unknown as ServiceDefinition<Record<string, never>>
  const code = runService(definition, { process: proc, clock, build: null })
  await flushPromises()
  return { proc, clock, code }
}

/**
 * Runs a service that has started and closes the way the case says.
 *
 * @param close - What `close()` does; it resolves when omitted.
 * @param platform - The platform the fake process names.
 * @returns The fakes and the promise for the exit code.
 */
const running = (close: unknown = async () => undefined, platform = 'linux'): Promise<Run> => run(() => ({ port: 8080, close }), platform)

describe('runService, stopping', () => {
  describe('causes', () => {
    it.each([
      ['SIGINT', 'linux'],
      ['SIGTERM', 'linux'],
      ['SIGBREAK', 'win32'],
    ])('stops on %s with its line and exit code 0', async (signal, platform) => {
      const { proc, code } = await running(undefined, platform)
      proc.emit(signal)
      expect({ code: await code, out: proc.out, err: proc.err, exits: proc.exits }).toEqual({
        code: 0,
        out: `${STARTED}stopping cause=signal signal=${signal}\nstopped\n`,
        err: '',
        exits: [0],
      })
    })

    it('stops on a closed channel with its line and exit code 0', async () => {
      const { proc, code } = await running()
      proc.emit('disconnect')
      expect({ code: await code, out: proc.out, err: proc.err }).toEqual({
        code: 0,
        out: `${STARTED}stopping cause=disconnect\nstopped\n`,
        err: '',
      })
    })

    it('writes the frames of an uncaught exception, and no message', async () => {
      const { proc } = await running()
      proc.emit('uncaughtException', new Error(MARKER), 'uncaughtException')
      expect(blockOf(proc.err)).toEqual({ head: 'fatal cause=uncaught-exception name=Error', framed: true, others: [''] })
    })

    it('stops and closes after an uncaught exception, with exit code 1', async () => {
      const { proc, code } = await running()
      proc.emit('uncaughtException', new Error(MARKER), 'uncaughtException')
      expect({ code: await code, out: proc.out }).toEqual({ code: 1, out: `${STARTED}stopping cause=fault\nstopped\n` })
    })

    it('writes the frames of an unhandled rejection, and no message', async () => {
      const { proc } = await running()
      proc.emit('unhandledRejection', new Error(MARKER), Promise.resolve())
      expect(blockOf(proc.err)).toEqual({ head: 'fatal cause=unhandled-rejection name=Error', framed: true, others: [''] })
    })

    it('stops and closes after an unhandled rejection, with exit code 1', async () => {
      const { proc, code } = await running()
      proc.emit('unhandledRejection', new Error(MARKER), Promise.resolve())
      expect({ code: await code, out: proc.out }).toEqual({ code: 1, out: `${STARTED}stopping cause=fault\nstopped\n` })
    })

    it('reports an uncaught exception that began as a rejection as a rejection', async () => {
      const { proc } = await running()
      proc.emit('uncaughtException', new Error(MARKER), 'unhandledRejection')
      expect(proc.err).toMatch(/^fatal cause=unhandled-rejection name=Error\n/)
    })

    it('adds the code of a fault that has one', async () => {
      const { proc } = await running()
      proc.emit('uncaughtException', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }), 'uncaughtException')
      expect(proc.err).toMatch(/^fatal cause=uncaught-exception name=Error code=EPIPE\n {4}at /)
    })

    it('reports a rejection with no reason, though nothing was thrown before it', async () => {
      const { proc } = await running()
      proc.emit('unhandledRejection', undefined, Promise.resolve())
      expect(proc.err).toBe('fatal cause=unhandled-rejection name=unknown\n')
    })

    it('prints nothing of a fault that is no error', async () => {
      const { proc } = await running()
      proc.emit('unhandledRejection', MARKER, Promise.resolve())
      expect(proc.err).toBe('fatal cause=unhandled-rejection name=unknown\n')
    })

    it('aborts the signal of the context before it calls close', async () => {
      const seen: boolean[] = []
      const start = (_values: unknown, context: RunContext): StartedService => ({
        close: async () => void seen.push(context.signal.aborted),
      })
      const { proc, code } = await run(start)
      proc.emit('SIGTERM')
      await code
      expect(seen).toEqual([true])
    })

    it('writes the stopping line before it aborts the signal', async () => {
      const seen: string[] = []
      const proc = fakeProcess()
      const start = (_values: unknown, context: RunContext): StartedService => {
        context.signal.addEventListener('abort', () => void seen.push(proc.out))
        return { close: async () => undefined }
      }
      void runService({ environment: { check: () => [], load: () => ({}) }, start } as never, {
        process: proc,
        clock: fakeClock(),
        build: null,
      })
      await flushPromises()
      proc.emit('SIGINT')
      expect(seen).toEqual(['started\nstopping cause=signal signal=SIGINT\n'])
    })
  })

  describe('while booting', () => {
    it('closes a usable value that arrives after a signal, with no started line and exit code 0', async () => {
      const start = pending<StartedService>()
      const closed: string[] = []
      const { proc, code } = await run(start.run)
      proc.emit('SIGTERM')
      start.resolve({ port: 8080, close: async () => void closed.push('closed') })
      expect({ code: await code, closed, out: proc.out, err: proc.err }).toEqual({
        code: 0,
        closed: ['closed'],
        out: 'stopping cause=signal signal=SIGTERM\nstopped\n',
        err: '',
      })
    })

    it('exits 0 with no fatal block for a rejection that arrives after a signal', async () => {
      const start = pending<StartedService>()
      const { proc, code } = await run(start.run)
      proc.emit('SIGTERM')
      start.reject(new Error(MARKER))
      expect({ code: await code, out: proc.out, err: proc.err }).toEqual({
        code: 0,
        out: 'stopping cause=signal signal=SIGTERM\n',
        err: '',
      })
    })

    it('exits 0 with no fatal block for an unusable value that arrives after a signal', async () => {
      const start = pending<StartedService>()
      const { proc, code } = await run(start.run)
      proc.emit('SIGTERM')
      start.resolve({})
      expect({ code: await code, out: proc.out, err: proc.err }).toEqual({
        code: 0,
        out: 'stopping cause=signal signal=SIGTERM\n',
        err: '',
      })
    })

    it('stops on a closed channel', async () => {
      const { proc } = await run(pending<StartedService>().run)
      proc.emit('disconnect')
      expect(proc.out).toBe('stopping cause=disconnect\n')
    })

    it('prints the message of a fault, since no request has been served', async () => {
      const { proc } = await run(pending<StartedService>().run)
      proc.emit('uncaughtException', new Error('Invalid service options:'), 'uncaughtException')
      expect(proc.err).toMatch(/^fatal cause=uncaught-exception name=Error\nInvalid service options:\n {4}at \S/)
    })

    it('exits 1 for a start that rejects after a fault, with one block', async () => {
      const start = pending<StartedService>()
      const { proc, code } = await run(start.run)
      proc.emit('unhandledRejection', MARKER, Promise.resolve())
      start.reject(new Error('second'))
      expect({ code: await code, out: proc.out, err: proc.err }).toEqual({
        code: 1,
        out: 'stopping cause=fault\n',
        err: 'fatal cause=unhandled-rejection name=unknown\n',
      })
    })

    it('clears the start timer when the stop begins', async () => {
      const { proc, clock } = await run(pending<StartedService>().run)
      proc.emit('SIGTERM')
      expect(clock.delays()).toEqual([15000])
    })

    it('does not end at the start time once a stop began', async () => {
      const { proc, clock } = await run(pending<StartedService>().run)
      clock.advance(20000)
      proc.emit('SIGTERM')
      clock.advance(14999)
      expect({ exits: proc.exits, err: proc.err }).toEqual({ exits: [], err: '' })
    })

    it('ends a start that never settles at the stop time, with a stop timeout', async () => {
      const { proc, clock, code } = await run(pending<StartedService>().run)
      proc.emit('SIGTERM')
      clock.advance(15000)
      expect({ code: await code, err: proc.err }).toEqual({ code: 1, err: 'fatal cause=stop-timeout\n' })
    })

    it('neither closes nor reports a value that arrives after the exit', async () => {
      const start = pending<StartedService>()
      const closed: string[] = []
      const { proc, clock, code } = await run(start.run)
      proc.emit('SIGTERM')
      clock.advance(15000)
      await code
      start.resolve({ close: async () => void closed.push('closed') })
      await flushPromises()
      expect({ closed, out: proc.out, exits: proc.exits }).toEqual({
        closed: [],
        out: 'stopping cause=signal signal=SIGTERM\n',
        exits: [1],
      })
    })

    it('reports nothing of a rejection that arrives after the exit', async () => {
      const start = pending<StartedService>()
      const { proc, clock, code } = await run(start.run)
      proc.emit('SIGTERM')
      clock.advance(15000)
      await code
      start.reject(new Error(MARKER))
      await flushPromises()
      expect({ err: proc.err, exits: proc.exits }).toEqual({ err: 'fatal cause=stop-timeout\n', exits: [1] })
    })
  })

  describe('close', () => {
    it('writes the frames of a close that rejects, with no message and no stopped line', async () => {
      const { proc, code } = await running(() => Promise.reject(new Error(MARKER)))
      proc.emit('SIGTERM')
      await code
      expect({ block: blockOf(proc.err), out: proc.out }).toEqual({
        block: { head: 'fatal cause=stop-failed name=Error', framed: true, others: [''] },
        out: `${STARTED}stopping cause=signal signal=SIGTERM\n`,
      })
    })

    it('exits 1 for a close that rejects', async () => {
      const { proc, code } = await running(() => Promise.reject(new Error(MARKER)))
      proc.emit('SIGTERM')
      expect(await code).toBe(1)
    })

    it('treats a close that throws as one that rejects', async () => {
      const close = (): never => {
        throw Object.assign(new TypeError(MARKER), { code: 'ERR_CLOSE' })
      }
      const { proc, code } = await running(close)
      proc.emit('SIGTERM')
      expect({ code: await code, err: proc.err.split(/\r?\n/)[0], marked: proc.err.includes(MARKER) }).toEqual({
        code: 1,
        err: 'fatal cause=stop-failed name=TypeError code=ERR_CLOSE',
        marked: false,
      })
    })

    it('treats a close that returns no promise as resolved', async () => {
      const { proc, code } = await running(() => undefined)
      proc.emit('SIGTERM')
      expect({ code: await code, out: proc.out }).toEqual({ code: 0, out: `${STARTED}stopping cause=signal signal=SIGTERM\nstopped\n` })
    })

    it('does nothing one millisecond before the default stop time', async () => {
      const { proc, clock } = await running(pending<void>().run)
      proc.emit('SIGTERM')
      clock.advance(14999)
      expect({ exits: proc.exits, err: proc.err }).toEqual({ exits: [], err: '' })
    })

    it('gives up at the default stop time, with exit code 1', async () => {
      const { proc, clock, code } = await running(pending<void>().run)
      proc.emit('SIGTERM')
      clock.advance(15000)
      expect({ code: await code, err: proc.err, out: proc.out }).toEqual({
        code: 1,
        err: 'fatal cause=stop-timeout\n',
        out: `${STARTED}stopping cause=signal signal=SIGTERM\n`,
      })
    })

    it('calls close once across several causes', async () => {
      const close = pending<void>()
      const { proc } = await running(close.run)
      proc.emit('SIGTERM')
      proc.emit('disconnect')
      proc.emit('uncaughtException', new Error(MARKER), 'uncaughtException')
      proc.emit('SIGINT')
      expect(close.calls).toBe(1)
    })

    it('writes no stopped line for a close that resolves after the exit', async () => {
      const close = pending<void>()
      const { proc, clock, code } = await running(close.run)
      proc.emit('SIGTERM')
      clock.advance(15000)
      await code
      close.resolve(undefined)
      await flushPromises()
      expect({ out: proc.out, exits: proc.exits }).toEqual({ out: `${STARTED}stopping cause=signal signal=SIGTERM\n`, exits: [1] })
    })

    it('writes no block for a close that rejects after the exit', async () => {
      const close = pending<void>()
      const { proc, clock, code } = await running(close.run)
      proc.emit('SIGTERM')
      clock.advance(15000)
      await code
      close.reject(new Error(MARKER))
      await flushPromises()
      expect({ err: proc.err, exits: proc.exits }).toEqual({ err: 'fatal cause=stop-timeout\n', exits: [1] })
    })
  })

  describe('while stopping', () => {
    it('writes the block of a fault with no message, and does not exit', async () => {
      const { proc } = await running(pending<void>().run)
      proc.emit('SIGTERM')
      proc.emit('unhandledRejection', new Error(MARKER), Promise.resolve())
      expect({ block: blockOf(proc.err), exits: proc.exits }).toEqual({
        block: { head: 'fatal cause=unhandled-rejection name=Error', framed: true, others: [''] },
        exits: [],
      })
    })

    it('exits 1 when close resolves after a fault, though the cause was a signal', async () => {
      const close = pending<void>()
      const { proc, code } = await running(close.run)
      proc.emit('SIGTERM')
      proc.emit('uncaughtException', new Error(MARKER), 'uncaughtException')
      close.resolve(undefined)
      expect({ code: await code, out: proc.out }).toEqual({ code: 1, out: `${STARTED}stopping cause=signal signal=SIGTERM\nstopped\n` })
    })

    it('keeps the stop timer as the bound after a fault', async () => {
      const { proc, clock, code } = await running(pending<void>().run)
      proc.emit('SIGTERM')
      clock.advance(5000)
      proc.emit('uncaughtException', MARKER, 'uncaughtException')
      clock.advance(9999)
      const before = [...proc.exits]
      clock.advance(1)
      expect({ before, code: await code, err: proc.err }).toEqual({
        before: [],
        code: 1,
        err: 'fatal cause=uncaught-exception name=unknown\nfatal cause=stop-timeout\n',
      })
    })

    it('writes a block for each of the first eight faults and none for the ninth', async () => {
      const { proc } = await running(pending<void>().run)
      proc.emit('SIGTERM')
      for (let fault = 1; fault <= 9; fault += 1) {
        proc.emit('uncaughtException', `fault ${fault}`, 'uncaughtException')
      }
      expect(proc.err).toBe('fatal cause=uncaught-exception name=unknown\n'.repeat(8))
    })

    it('takes one value handed to both listeners as one fault', async () => {
      const { proc } = await running(pending<void>().run)
      const reason = new Error(MARKER)
      proc.emit('uncaughtException', reason, 'unhandledRejection')
      proc.emit('unhandledRejection', reason, Promise.resolve())
      expect(proc.err.split('fatal cause=').length - 1).toBe(1)
    })

    it('takes a thrown NaN handed to both listeners as one fault', async () => {
      const { proc } = await running(pending<void>().run)
      proc.emit('uncaughtException', Number.NaN, 'unhandledRejection')
      proc.emit('unhandledRejection', Number.NaN, Promise.resolve())
      expect(proc.err).toBe('fatal cause=unhandled-rejection name=unknown\n')
    })

    it('takes another value after it as a fault of its own', async () => {
      const { proc } = await running(pending<void>().run)
      proc.emit('uncaughtException', 'first', 'uncaughtException')
      proc.emit('uncaughtException', 'second', 'uncaughtException')
      expect(proc.err).toBe('fatal cause=uncaught-exception name=unknown\n'.repeat(2))
    })

    it('ignores a repeated signal 999 milliseconds after the stop began', async () => {
      const { proc, clock } = await running(pending<void>().run)
      clock.advance(60000)
      proc.emit('SIGINT')
      clock.advance(999)
      proc.emit('SIGINT')
      expect({ exits: proc.exits, err: proc.err }).toEqual({ exits: [], err: '' })
    })

    it('ends the process at once on a signal 1000 milliseconds after the stop began', async () => {
      const { proc, clock, code } = await running(pending<void>().run)
      clock.advance(60000)
      proc.emit('SIGINT')
      clock.advance(1000)
      proc.emit('SIGTERM')
      expect({ code: await code, err: proc.err, out: proc.out }).toEqual({
        code: 1,
        err: 'fatal cause=forced signal=SIGTERM\n',
        out: `${STARTED}stopping cause=signal signal=SIGINT\n`,
      })
    })

    it('ignores a closed channel', async () => {
      const { proc, clock } = await running(pending<void>().run)
      proc.emit('SIGINT')
      clock.advance(5000)
      proc.emit('disconnect')
      expect({ exits: proc.exits, out: proc.out }).toEqual({ exits: [], out: `${STARTED}stopping cause=signal signal=SIGINT\n` })
    })
  })
})
