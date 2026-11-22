import type { ServiceClock } from './clock'
import type { ServiceDefinition } from './run'
import { EventEmitter } from 'node:events'
import { createDeferred, describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { runService } from './run'

const MARKER = 'message-marker'
const ISSUE = { name: 'PORT', group: 'http', problem: 'missing', expected: 'a port' }
const ENVIRONMENT_BLOCK = 'fatal cause=environment\n  - PORT (http) is missing; expected a port.\n'
const EVENTS = ['SIGINT', 'SIGTERM', 'disconnect', 'uncaughtException', 'unhandledRejection']

/** How a fake stream answers a write: it calls back at once, keeps the callback, throws, or calls back and then throws. */
type StreamMode = 'answers' | 'withholds' | 'throws' | 'answers-then-throws'

/** A fake stream. */
interface FakeStream {
  /** How the next writes are answered. */
  mode: StreamMode
  /** The callbacks it kept. */
  readonly kept: (() => void)[]
  /** Writes text, as the runner calls it. */
  write(text: string, done?: () => void): void
}

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
  /** What happened, in order: a flush of either stream, and the exit. */
  log: string[]
  /** Every code `exit` was called with. */
  exits: number[]
  /** How many events had a listener each time `exit` was called. */
  listening: number[]
  /** Standard output. */
  stdout: FakeStream
  /** Standard error. */
  stderr: FakeStream
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

/**
 * Builds a fake process whose two streams answer the way the case says.
 *
 * @param stdout - How standard output answers a write.
 * @param stderr - How standard error answers a write.
 * @returns An event emitter with the members the runner uses.
 */
const fakeProcess = (stdout: StreamMode = 'answers', stderr: StreamMode = 'answers'): FakeProcess => {
  const stream = (name: 'out' | 'err', mode: StreamMode): FakeStream => {
    const made: FakeStream = {
      mode,
      kept: [],
      write: (text, done) => {
        proc[name] += text
        if (done !== undefined) {
          proc.log.push(`flush ${name}`)
        }
        if (made.mode === 'throws') {
          throw new Error('write EPIPE')
        }
        if (made.mode === 'withholds') {
          made.kept.push(done ?? (() => undefined))
          return
        }
        done?.()
        if (made.mode === 'answers-then-throws') {
          throw new Error('write EPIPE')
        }
      },
    }
    return made
  }
  const proc: FakeProcess = Object.assign(new EventEmitter(), {
    env: {},
    platform: 'linux',
    out: '',
    err: '',
    log: [] as string[],
    exits: [] as number[],
    listening: [] as number[],
    stdout: stream('out', stdout),
    stderr: stream('err', stderr),
    exit: (code: number) => {
      proc.log.push('exit')
      proc.listening.push(proc.eventNames().length)
      proc.exits.push(code)
    },
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
 * Runs a service over fakes, from source, and lets its start settle.
 *
 * @param proc - The fake process to run on.
 * @param members - What the case replaces in a definition that boots and closes at once.
 * @returns The fakes and the promise for the exit code.
 */
const run = async (proc: FakeProcess = fakeProcess(), members: Record<string, unknown> = {}): Promise<Run> => {
  const clock = fakeClock()
  const definition = {
    environment: { check: () => [], load: () => ({}) },
    start: () => ({ close: async () => undefined }),
    ...members,
  } as unknown as ServiceDefinition<Record<string, never>>
  const code = runService(definition, { process: proc, clock, build: null })
  await flushPromises()
  return { proc, clock, code }
}

/**
 * Runs a service to the middle of its exit: it was asked to stop, it closed, and standard output keeps the callback of the flush.
 *
 * @returns The fakes and the promise for the exit code, which is 0 once the flush is let through.
 */
const flushing = async (): Promise<Run> => {
  const started = await run(fakeProcess('withholds'))
  started.proc.emit('SIGTERM')
  await flushPromises()
  return started
}

/**
 * Lets through every callback a stream kept.
 *
 * @param stream - The fake stream.
 */
const release = (stream: FakeStream): void => {
  stream.kept.splice(0).forEach((done) => done())
}

describe('runService, the exit', () => {
  describe('order', () => {
    it('flushes standard output, then standard error, then exits', async () => {
      const { proc, code } = await run()
      proc.emit('SIGTERM')
      await code
      expect(proc.log).toEqual(['flush out', 'flush err', 'exit'])
    })

    it('flushes each stream with an empty write', async () => {
      const { proc, code } = await run()
      proc.emit('SIGTERM')
      await code
      expect({ out: proc.out, err: proc.err }).toEqual({ out: 'started\nstopping cause=signal signal=SIGTERM\nstopped\n', err: '' })
    })

    it('waits for standard output before it flushes standard error', async () => {
      const { proc } = await flushing()
      expect(proc.log).toEqual(['flush out'])
    })

    it('waits for standard error before it exits', async () => {
      const proc = fakeProcess('answers', 'withholds')
      await run(proc)
      proc.emit('SIGTERM')
      await flushPromises()
      expect(proc.log).toEqual(['flush out', 'flush err'])
    })

    it('exits in the callback of standard error', async () => {
      const proc = fakeProcess('answers', 'withholds')
      const { code } = await run(proc)
      proc.emit('SIGTERM')
      await flushPromises()
      release(proc.stderr)
      expect({ code: await code, exits: proc.exits }).toEqual({ code: 0, exits: [0] })
    })

    it('keeps the flush deadline as its only timer from the first flush on', async () => {
      const { clock } = await flushing()
      expect(clock.delays()).toEqual([2000])
    })

    it('has removed its listeners by the time it asks the process to exit', async () => {
      const { proc, code } = await run()
      proc.emit('SIGTERM')
      await code
      expect(proc.listening).toEqual([0])
    })

    it('leaves no timer once it asked the process to exit', async () => {
      const { proc, clock, code } = await flushing()
      release(proc.stdout)
      await code
      expect(clock.delays()).toEqual([])
    })
  })

  describe('during the flush', () => {
    it('keeps its listeners installed', async () => {
      const { proc } = await flushing()
      expect(proc.eventNames()).toEqual(EVENTS)
    })

    it.each([
      ['a signal', 0, ['SIGINT']],
      ['a signal past the force window', 1500, ['SIGTERM']],
      ['a closed channel', 0, ['disconnect']],
      ['an uncaught exception', 0, ['uncaughtException', new Error(MARKER), 'uncaughtException']],
      ['an unhandled rejection', 0, ['unhandledRejection', new Error(MARKER), Promise.resolve()]],
    ] as const)('writes nothing for %s', async (_name, after, [event, ...values]) => {
      const { proc, clock } = await flushing()
      clock.advance(after)
      proc.emit(event, ...values)
      expect({ out: proc.out, err: proc.err, exits: proc.exits }).toEqual({
        out: 'started\nstopping cause=signal signal=SIGTERM\nstopped\n',
        err: '',
        exits: [],
      })
    })

    it('leaves the exit code as it was, whatever arrived', async () => {
      const { proc, clock, code } = await flushing()
      clock.advance(1500)
      proc.emit('SIGINT')
      proc.emit('uncaughtException', new Error(MARKER), 'uncaughtException')
      release(proc.stdout)
      expect({ code: await code, exits: proc.exits }).toEqual({ code: 0, exits: [0] })
    })

    it('keeps exit code 78 when the write of the fatal block fails once it returned', async () => {
      const proc = fakeProcess()
      const write = proc.stderr.write
      proc.stderr.write = (text, done) => {
        write(text, done)
        queueMicrotask(() =>
          proc.emit('uncaughtException', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }), 'uncaughtException')
        )
      }
      const { code } = await run(proc, { environment: { check: () => [ISSUE], load: () => ({}) } })
      expect({ code: await code, exits: proc.exits, err: proc.err }).toEqual({ code: 78, exits: [78], err: ENVIRONMENT_BLOCK })
    })

    it('keeps exit code 78 when the write of the fatal block fails before it returns', async () => {
      const proc = fakeProcess()
      const write = proc.stderr.write
      proc.stderr.write = (text, done) => {
        proc.emit('uncaughtException', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }), 'uncaughtException')
        write(text, done)
      }
      const { code } = await run(proc, { environment: { check: () => [ISSUE], load: () => ({}) } })
      expect({ code: await code, exits: proc.exits, err: proc.err, out: proc.out }).toEqual({
        code: 78,
        exits: [78],
        err: ENVIRONMENT_BLOCK,
        out: '',
      })
    })
  })

  describe('streams that fail', () => {
    it.each([
      ['standard output throws', 'throws', 'answers'],
      ['standard error throws', 'answers', 'throws'],
      ['both throw', 'throws', 'throws'],
    ] as const)('still exits when %s', async (_name, stdout, stderr) => {
      const proc = fakeProcess(stdout, stderr)
      const { code } = await run(proc)
      proc.emit('SIGTERM')
      expect({ code: await code, exits: proc.exits }).toEqual({ code: 0, exits: [0] })
    })

    it('still flushes standard error when standard output throws', async () => {
      const proc = fakeProcess('throws')
      const { code } = await run(proc)
      proc.emit('SIGTERM')
      await code
      expect(proc.log).toEqual(['flush out', 'flush err', 'exit'])
    })

    it('exits once when a stream calls back and then throws', async () => {
      const proc = fakeProcess('answers-then-throws', 'answers-then-throws')
      const { code } = await run(proc)
      proc.emit('SIGTERM')
      await code
      expect(proc.exits).toEqual([0])
    })

    it('does not exit 1999 milliseconds into a flush that never calls back', async () => {
      const { proc, clock } = await flushing()
      clock.advance(1999)
      expect(proc.exits).toEqual([])
    })

    it('exits at 2000 milliseconds into a flush that never calls back', async () => {
      const { proc, clock, code } = await flushing()
      clock.advance(2000)
      expect({ code: await code, exits: proc.exits, listening: proc.listening }).toEqual({ code: 0, exits: [0], listening: [0] })
    })

    it('exits once when the callback arrives after the deadline', async () => {
      const { proc, clock, code } = await flushing()
      clock.advance(2000)
      await code
      release(proc.stdout)
      expect(proc.exits).toEqual([0])
    })

    it('gives up on standard error at the same deadline', async () => {
      const proc = fakeProcess('answers', 'withholds')
      const { clock, code } = await run(proc)
      proc.emit('SIGTERM')
      await flushPromises()
      clock.advance(2000)
      expect({ code: await code, exits: proc.exits }).toEqual({ code: 0, exits: [0] })
    })
  })

  describe('endings that race', () => {
    it('exits once, with the first code, when close rejects during the flush of a stop timeout', async () => {
      const settle = createDeferred()
      const close = (): Promise<void> => settle.promise
      const proc = fakeProcess('withholds')
      const { clock, code } = await run(proc, { start: () => ({ close }) })
      proc.emit('SIGTERM')
      clock.advance(15000)
      settle.reject(new Error(MARKER))
      await flushPromises()
      release(proc.stdout)
      expect({ code: await code, exits: proc.exits, err: proc.err }).toEqual({ code: 1, exits: [1], err: 'fatal cause=stop-timeout\n' })
    })

    it('exits once when a forced stop and the stop timer meet', async () => {
      const proc = fakeProcess('withholds')
      const { clock, code } = await run(proc, { start: () => ({ close: () => new Promise<void>(() => undefined) }) })
      proc.emit('SIGTERM')
      clock.advance(1000)
      proc.emit('SIGTERM')
      clock.advance(14000)
      release(proc.stdout)
      expect({ code: await code, exits: proc.exits, err: proc.err }).toEqual({
        code: 1,
        exits: [1],
        err: 'fatal cause=forced signal=SIGTERM\n',
      })
    })
  })

  describe('after any ending', () => {
    it.each([
      ['a refused environment', { environment: { check: () => [ISSUE], load: () => ({}) } }, []],
      ['a start that rejects', { start: () => Promise.reject(new Error(MARKER)) }, []],
      ['a start that resolves nothing usable', { start: () => null }, []],
      ['a stop on a signal', {}, ['SIGINT']],
      ['a stop on a closed channel', {}, ['disconnect']],
      ['a stop after a fault', {}, ['uncaughtException']],
      ['a close that rejects', { start: () => ({ close: () => Promise.reject(new Error(MARKER)) }) }, ['SIGTERM']],
    ] as const)('leaves no listener and no timer after %s', async (_name, members, events) => {
      const { proc, clock, code } = await run(fakeProcess(), members)
      events.forEach((event) => proc.emit(event, new Error(MARKER)))
      await code
      expect({ events: proc.eventNames(), timers: clock.delays() }).toEqual({ events: [], timers: [] })
    })

    it('resolves with the code it asked the process to exit with, and does not reject', async () => {
      const { proc, code } = await run(fakeProcess('throws', 'throws'), { start: () => Promise.reject(MARKER) })
      await expect(code).resolves.toBe(proc.exits[0])
    })
  })
})
