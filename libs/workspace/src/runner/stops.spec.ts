import type { CommandStops, StopListener, StopSignal, StopsDependencies } from './stops'
import { afterEach } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createFakeChildProcess } from '@hyperfrontend/testing/process'
import { processStops, RESIGNAL_INTERVAL, watchStops } from './stops'

afterEach(() => jest.restoreAllMocks())

/** A signal a fake process was asked to call a handler for. */
type Registration = readonly [signal: StopSignal, handler: () => void]

/** A signal a fake process sent. */
type Sent = readonly [pid: number, signal: StopSignal]

/** How a fake process differs from a macOS one that lists nothing and signals anything. */
interface FakeProcessOptions {
  /** The platform; macOS unless named. */
  readonly platform?: string
  /** What `ps` prints, or the error it throws. */
  readonly listing?: string | Error
  /** The processes that have already ended, which cannot be signalled. */
  readonly gone?: readonly number[]
}

/** A process that is all fakes. */
interface FakeProcess {
  /** What the stops are built from. */
  readonly dependencies: Required<StopsDependencies>
  /** The handlers registered and not removed, in order. */
  readonly registered: Registration[]
  /** The signals asked for, in order, those refused included. */
  readonly sent: Sent[]
  /** How many times `ps` ran. */
  readonly listings: () => number
  /** Changes what `ps` prints from then on, as processes come and go. */
  readonly relist: (listing: string) => void
  /** Lets every interval running pass once. */
  readonly tick: () => void
}

/** A shell (412), the command it started (9731), that command's worker (9732), and a process apart (500). */
const LISTING = '    1     0 init\n  412     1 sh\n 9731   412 node\n 9732  9731 node\n  500     1 cron\n'

/**
 * A process whose signals, platform, process listing, kill and interval are fakes.
 *
 * @param options - The platform, the listing and the processes already gone
 * @returns The dependencies and what they recorded
 */
function fakeProcess(options: FakeProcessOptions = {}): FakeProcess {
  const registered: Registration[] = []
  const sent: Sent[] = []
  const { gone = [] } = options
  const ticks: (() => void)[] = []
  let listing = options.listing ?? ''
  let listings = 0
  return {
    dependencies: {
      source: {
        on: (signal, handler) => registered.push([signal, handler]),
        off: (signal, handler) =>
          registered.splice(
            registered.findIndex(([name, own]) => name === signal && own === handler),
            1
          ),
      },
      platform: options.platform ?? 'darwin',
      listDirectory: () => ['412', '9731'],
      readFile: (path) => (path.includes('9731') ? '9731 (node) S 412 9731 412' : '412 (sh) S 1 412 412'),
      listWithPs: () => {
        listings += 1
        if (listing instanceof Error) throw listing
        return listing
      },
      kill: (pid, signal) => {
        sent.push([pid, signal])
        if (gone.includes(pid)) throw createError('kill ESRCH')
      },
      every: (_milliseconds, tick) => {
        ticks.push(tick)
        return () => void ticks.splice(ticks.indexOf(tick), 1)
      },
    },
    registered,
    sent,
    listings: () => listings,
    relist: (next) => {
      listing = next
    },
    tick: () => [...ticks].forEach((tick) => tick()),
  }
}

/** What a fake way of telling the commands recorded. */
interface FakeStops {
  /** The stops. */
  readonly stops: CommandStops
  /** Asks every listener to stop. */
  readonly stop: () => void
  /** Lets every interval running pass once. */
  readonly tick: () => void
  /** What each process has started, by process id; a case changes it as processes come and go. */
  readonly started: Record<number, readonly number[] | undefined>
  /** The processes signalled, in order. */
  readonly signalled: number[]
  /** The processes each call was asked about, in order. */
  readonly asked: number[]
  /** How many listeners are listening. */
  readonly listening: () => number
  /** The intervals started, by their milliseconds, those cancelled included. */
  readonly intervals: number[]
  /** How many intervals are running. */
  readonly ticking: () => number
}

/**
 * A way of telling the commands whose processes are a table of the case: a signal goes to what a
 * process started, or to the process where it started nothing, and never to a process left out.
 *
 * @returns The stops, how a case asks for a stop and lets time pass, and what was signalled
 */
function fakeStops(): FakeStops {
  const listeners: StopListener[] = []
  const ticks: (() => void)[] = []
  const started: Record<number, readonly number[] | undefined> = {}
  const signalled: number[] = []
  const asked: number[] = []
  const intervals: number[] = []
  return {
    stops: {
      listen: (listener) => {
        listeners.push(listener)
        return () => void listeners.splice(listeners.indexOf(listener), 1)
      },
      signalStarted: (pid, _signal, skip) => {
        asked.push(pid)
        const reached = (started[pid] ?? [pid]).filter((target) => skip?.has(target) !== true)
        signalled.push(...reached)
        return reached
      },
      every: (milliseconds, tick) => {
        intervals.push(milliseconds)
        ticks.push(tick)
        return () => void ticks.splice(ticks.indexOf(tick), 1)
      },
    },
    stop: () => [...listeners].forEach((listener) => listener('SIGTERM')),
    tick: () => [...ticks].forEach((tick) => tick()),
    started,
    signalled,
    asked,
    listening: () => listeners.length,
    intervals,
    ticking: () => ticks.length,
  }
}

/**
 * How many timers keep this process running.
 *
 * @returns The number of timers the process waits for before it may end
 */
function timersHeld(): number {
  return process.getActiveResourcesInfo().filter((resource) => resource === 'Timeout').length
}

describe('processStops', () => {
  describe('signalStarted', () => {
    it('signals everything a shell wrapper started, and not the wrapper', () => {
      const { dependencies, sent } = fakeProcess({ listing: LISTING })
      processStops(dependencies).signalStarted(412, 'SIGTERM')
      expect(sent).toEqual([
        [9731, 'SIGTERM'],
        [9732, 'SIGTERM'],
      ])
    })

    it('answers the processes it signalled below a shell wrapper', () => {
      const { dependencies } = fakeProcess({ listing: LISTING })
      expect(processStops(dependencies).signalStarted(412, 'SIGTERM')).toEqual([9731, 9732])
    })

    it('signals a command that replaced its shell, and the worker it started', () => {
      const { dependencies, sent } = fakeProcess({ listing: LISTING })
      processStops(dependencies).signalStarted(9731, 'SIGTERM')
      expect(sent).toEqual([
        [9731, 'SIGTERM'],
        [9732, 'SIGTERM'],
      ])
    })

    it('signals a worker that appears under such a command, and not the command again', () => {
      const { dependencies, sent } = fakeProcess({ listing: LISTING })
      processStops(dependencies).signalStarted(9731, 'SIGTERM', createSet([9731]))
      expect(sent).toEqual([[9732, 'SIGTERM']])
    })

    it('tells a shell wrapper listed as a path with spaces from a command', () => {
      const { dependencies, sent } = fakeProcess({ listing: '  412     1 /Volumes/My Disk/bin/sh\n 9731   412 /usr/local/bin/node\n' })
      processStops(dependencies).signalStarted(412, 'SIGTERM')
      expect(sent).toEqual([[9731, 'SIGTERM']])
    })

    it('signals a shell wrapper itself once it has started nothing', () => {
      const { dependencies, sent } = fakeProcess({ listing: '  412     1 sh\n' })
      processStops(dependencies).signalStarted(412, 'SIGTERM')
      expect(sent).toEqual([[412, 'SIGTERM']])
    })

    it('signals a command that started nothing', () => {
      const { dependencies, sent } = fakeProcess({ listing: LISTING })
      processStops(dependencies).signalStarted(500, 'SIGTERM')
      expect(sent).toEqual([[500, 'SIGTERM']])
    })

    it('answers a command that started nothing when that is what it signalled', () => {
      const { dependencies } = fakeProcess({ listing: LISTING })
      expect(processStops(dependencies).signalStarted(500, 'SIGTERM')).toEqual([500])
    })

    it('signals the process itself, and nothing else, when the processes cannot be listed', () => {
      const { dependencies, sent } = fakeProcess({ listing: createError('spawnSync ps ENOENT') })
      processStops(dependencies).signalStarted(412, 'SIGTERM')
      expect(sent).toEqual([[412, 'SIGTERM']])
    })

    it('signals the process itself, and nothing else, when the listing holds no process', () => {
      const { dependencies, sent } = fakeProcess({ listing: 'ps: unknown option\n' })
      processStops(dependencies).signalStarted(412, 'SIGTERM')
      expect(sent).toEqual([[412, 'SIGTERM']])
    })

    it('leaves out the processes below a shell wrapper it is told to skip', () => {
      const { dependencies, sent } = fakeProcess({ listing: LISTING })
      processStops(dependencies).signalStarted(412, 'SIGTERM', createSet([9731]))
      expect(sent).toEqual([[9732, 'SIGTERM']])
    })

    it('signals nothing, the shell wrapper included, while what the wrapper started still runs and is all skipped', () => {
      const { dependencies, sent } = fakeProcess({ listing: LISTING })
      const reached = processStops(dependencies).signalStarted(412, 'SIGTERM', createSet([9731, 9732]))
      expect({ reached, sent }).toEqual({ reached: [], sent: [] })
    })

    it('leaves out a command that started nothing when it is skipped', () => {
      const { dependencies, sent } = fakeProcess({ listing: LISTING })
      const reached = processStops(dependencies).signalStarted(500, 'SIGTERM', createSet([500]))
      expect({ reached, sent }).toEqual({ reached: [], sent: [] })
    })

    it('goes on to the next process below a shell wrapper when one has already ended', () => {
      const { dependencies, sent } = fakeProcess({ listing: LISTING, gone: [9731] })
      processStops(dependencies).signalStarted(412, 'SIGTERM')
      expect(sent).toEqual([
        [9731, 'SIGTERM'],
        [9732, 'SIGTERM'],
      ])
    })

    it('leaves a process that has already ended out of its answer', () => {
      const { dependencies } = fakeProcess({ listing: LISTING, gone: [9731] })
      expect(processStops(dependencies).signalStarted(412, 'SIGTERM')).toEqual([9732])
    })

    it('answers nothing, without throwing, when the process itself has already ended', () => {
      const { dependencies } = fakeProcess({ gone: [412] })
      expect(processStops(dependencies).signalStarted(412, 'SIGTERM')).toEqual([])
    })

    it('reads the processes and their names from /proc on linux, without running ps', () => {
      const { dependencies, sent, listings } = fakeProcess({ platform: 'linux', listing: LISTING })
      processStops(dependencies).signalStarted(412, 'SIGTERM')
      expect({ listings: listings(), sent }).toEqual({ listings: 0, sent: [[9731, 'SIGTERM']] })
    })

    it('lists no process on win32, and signals the process itself', () => {
      const { dependencies, sent, listings } = fakeProcess({ platform: 'win32', listing: LISTING })
      processStops(dependencies).signalStarted(412, 'SIGTERM')
      expect({ listings: listings(), sent }).toEqual({ listings: 0, sent: [[412, 'SIGTERM']] })
    })

    it('signals through the process unless given another way', () => {
      const kill = jest.spyOn(process, 'kill').mockImplementation(() => true)
      const { dependencies } = fakeProcess({ listing: LISTING })
      processStops({ ...dependencies, kill: undefined }).signalStarted(500, 'SIGTERM')
      expect(kill.mock.calls).toEqual([[500, 'SIGTERM']])
    })
  })

  describe('listen', () => {
    it('listens for a terminate signal alone', () => {
      const { dependencies, registered } = fakeProcess()
      processStops(dependencies).listen(() => undefined)
      expect(registered.map(([signal]) => signal)).toEqual(['SIGTERM'])
    })

    it('tells the listener which signal arrived', () => {
      const { dependencies, registered } = fakeProcess()
      const heard: StopSignal[] = []
      processStops(dependencies).listen((signal) => heard.push(signal))
      for (const [, handler] of registered) handler()
      expect(heard).toEqual(['SIGTERM'])
    })

    it('stops listening through the function it answers, leaving the handlers of others', () => {
      const { dependencies, registered } = fakeProcess()
      const other = (): void => undefined
      dependencies.source.on('SIGTERM', other)
      processStops(dependencies).listen(() => undefined)()
      expect(registered).toEqual([['SIGTERM', other]])
    })

    it('listens for nothing on win32', () => {
      const { dependencies, registered } = fakeProcess({ platform: 'win32' })
      processStops(dependencies).listen(() => undefined)
      expect(registered).toEqual([])
    })

    it('answers a function that removes nothing on win32', () => {
      const { dependencies, registered } = fakeProcess({ platform: 'win32' })
      const other = (): void => undefined
      dependencies.source.on('SIGTERM', other)
      processStops(dependencies).listen(() => undefined)()
      expect(registered).toEqual([['SIGTERM', other]])
    })

    it('reads the platform of the process unless given one', () => {
      const { dependencies, registered } = fakeProcess()
      processStops({ ...dependencies, platform: undefined }).listen(() => undefined)
      expect(registered.map(([signal]) => signal)).toEqual(process.platform === 'win32' ? [] : ['SIGTERM'])
    })

    it('listens on the process, and stops, unless given another source', () => {
      const before = process.listenerCount('SIGTERM')
      const unlisten = processStops({ platform: 'linux' }).listen(() => undefined)
      const during = process.listenerCount('SIGTERM')
      unlisten()
      expect({ during: during - before, after: process.listenerCount('SIGTERM') - before }).toEqual({ during: 1, after: 0 })
    })
  })

  describe('every', () => {
    it('is the interval it is given', () => {
      const { dependencies } = fakeProcess()
      expect(processStops(dependencies).every).toBe(dependencies.every)
    })

    it('starts an interval that does not keep the process running, unless given another', () => {
      const before = timersHeld()
      const cancel = processStops().every(60_000, () => undefined)
      const during = timersHeld()
      cancel()
      expect(during - before).toBe(0)
    })
  })
})

describe('watchStops over processStops', () => {
  it('signals a command that replaced its shell and its worker once, and a worker started later on the next look', () => {
    const { dependencies, sent, registered, relist, tick } = fakeProcess({ listing: '9731 1 node\n9732 9731 node\n' })
    const watch = watchStops(processStops(dependencies))
    watch.track(createFakeChildProcess({ pid: 9731 }))
    for (const [, handler] of [...registered]) handler()
    relist('9731 1 node\n9732 9731 node\n9733 9731 node\n')
    tick()
    tick()
    watch.release()
    expect(sent.map(([pid]) => pid)).toEqual([9731, 9732, 9733])
  })

  it('signals what a shell wrapper starts after the stop, and the wrapper only once nothing runs below it', () => {
    const { dependencies, sent, registered, relist, tick } = fakeProcess({ listing: '412 1 sh\n9731 412 node\n' })
    const watch = watchStops(processStops(dependencies))
    watch.track(createFakeChildProcess({ pid: 412 }))
    for (const [, handler] of [...registered]) handler()
    tick()
    relist('412 1 sh\n9740 412 node\n')
    tick()
    tick()
    relist('412 1 sh\n')
    tick()
    tick()
    watch.release()
    expect(sent.map(([pid]) => pid)).toEqual([9731, 9740, 412])
  })
})

describe('watchStops', () => {
  it('passes a stop on to every command it was given', () => {
    const { stops, stop, signalled } = fakeStops()
    const watch = watchStops(stops)
    watch.track(createFakeChildProcess({ pid: 41 }))
    watch.track(createFakeChildProcess({ pid: 42 }))
    stop()
    expect(signalled).toEqual([41, 42])
  })

  it('passes nothing on to a command that has exited', () => {
    const { stops, stop, signalled } = fakeStops()
    const watch = watchStops(stops)
    const ended = createFakeChildProcess({ pid: 41 })
    watch.track(ended)
    watch.track(createFakeChildProcess({ pid: 42 }))
    ended.exit(0)
    stop()
    expect(signalled).toEqual([42])
  })

  it('leaves out a command the system never started', () => {
    const { stops, stop, asked } = fakeStops()
    const unstarted = createFakeChildProcess()
    unstarted.pid = undefined
    watchStops(stops).track(unstarted)
    stop()
    expect(asked).toEqual([])
  })

  it('says a stop was asked for once one was, and not before', () => {
    const { stops, stop } = fakeStops()
    const watch = watchStops(stops)
    const before = watch.stopped()
    stop()
    expect({ before, after: watch.stopped() }).toEqual({ before: false, after: true })
  })

  it('looks at the commands again on an interval once a stop was asked for', () => {
    const { stops, stop, intervals } = fakeStops()
    watchStops(stops).track(createFakeChildProcess({ pid: 41 }))
    stop()
    expect(intervals).toEqual([RESIGNAL_INTERVAL])
  })

  it('starts no interval while no stop was asked for', () => {
    const { stops, intervals } = fakeStops()
    const watch = watchStops(stops)
    watch.track(createFakeChildProcess({ pid: 41 }))
    watch.release()
    expect(intervals).toEqual([])
  })

  it('starts one interval however many times a stop is asked for', () => {
    const { stops, stop, intervals } = fakeStops()
    watchStops(stops).track(createFakeChildProcess({ pid: 41 }))
    stop()
    stop()
    expect(intervals).toEqual([RESIGNAL_INTERVAL])
  })

  it('signals a process that appears after the stop, on the next look', () => {
    const { stops, stop, tick, started, signalled } = fakeStops()
    watchStops(stops).track(createFakeChildProcess({ pid: 41 }))
    started[41] = [411]
    stop()
    started[41] = [412]
    tick()
    expect(signalled).toEqual([411, 412])
  })

  it('never signals a process a second time, on a later look or a later stop', () => {
    const { stops, stop, tick, started, signalled } = fakeStops()
    watchStops(stops).track(createFakeChildProcess({ pid: 41 }))
    started[41] = [411]
    stop()
    tick()
    stop()
    tick()
    expect(signalled).toEqual([411])
  })

  it('signals the process of a command itself on a later look, when what it started has ended and nothing took its place', () => {
    const { stops, stop, tick, started, signalled } = fakeStops()
    watchStops(stops).track(createFakeChildProcess({ pid: 41 }))
    started[41] = [411]
    stop()
    started[41] = undefined
    tick()
    expect(signalled).toEqual([411, 41])
  })

  it('looks no longer at a command that has exited', () => {
    const { stops, stop, tick, asked } = fakeStops()
    const child = createFakeChildProcess({ pid: 41 })
    watchStops(stops).track(child)
    stop()
    child.exit(0)
    tick()
    expect(asked).toEqual([41])
  })

  it('listens until it is released', () => {
    const { stops, listening } = fakeStops()
    const watch = watchStops(stops)
    const during = listening()
    watch.release()
    expect({ during, after: listening() }).toEqual({ during: 1, after: 0 })
  })

  it('looks until it is released', () => {
    const { stops, stop, ticking } = fakeStops()
    const watch = watchStops(stops)
    stop()
    const during = ticking()
    watch.release()
    expect({ during, after: ticking() }).toEqual({ during: 1, after: 0 })
  })

  it('ends a running command by signalling what the stops reach for it, and not through its own handle', () => {
    const { stops, started, signalled } = fakeStops()
    const child = createFakeChildProcess({ pid: 41 })
    const watch = watchStops(stops)
    watch.track(child)
    started[41] = [411, 412]
    watch.end(child)
    expect({ signalled, killed: child.kill.mock.calls }).toEqual({ signalled: [411, 412], killed: [] })
  })

  it('signals nothing a second time when a stop follows the end of a command', () => {
    const { stops, stop, started, signalled } = fakeStops()
    const child = createFakeChildProcess({ pid: 41 })
    const watch = watchStops(stops)
    watch.track(child)
    started[41] = [411]
    watch.end(child)
    stop()
    expect(signalled).toEqual([411])
  })

  it('looks again at a command it ended, signalling what its process starts afterwards', () => {
    const { stops, tick, started, signalled } = fakeStops()
    const child = createFakeChildProcess({ pid: 41 })
    const watch = watchStops(stops)
    watch.track(child)
    started[41] = [411]
    watch.end(child)
    started[41] = [412]
    tick()
    expect(signalled).toEqual([411, 412])
  })

  it('looks at the commands it ended alone while no stop was asked for', () => {
    const { stops, tick, asked } = fakeStops()
    const child = createFakeChildProcess({ pid: 41 })
    const watch = watchStops(stops)
    watch.track(child)
    watch.track(createFakeChildProcess({ pid: 42 }))
    watch.end(child)
    tick()
    expect(asked).toEqual([41, 41])
  })

  it('looks at every command once a stop follows the end of one', () => {
    const { stops, stop, tick, asked } = fakeStops()
    const child = createFakeChildProcess({ pid: 41 })
    const watch = watchStops(stops)
    watch.track(child)
    watch.track(createFakeChildProcess({ pid: 42 }))
    watch.end(child)
    stop()
    tick()
    expect(asked).toEqual([41, 41, 42, 41, 42])
  })

  it('starts one interval for the commands it ends and a stop that follows', () => {
    const { stops, stop, intervals } = fakeStops()
    const first = createFakeChildProcess({ pid: 41 })
    const second = createFakeChildProcess({ pid: 42 })
    const watch = watchStops(stops)
    watch.track(first)
    watch.track(second)
    watch.end(first)
    watch.end(second)
    stop()
    expect(intervals).toEqual([RESIGNAL_INTERVAL])
  })

  it('does not take the end of a command for a stop', () => {
    const { stops } = fakeStops()
    const child = createFakeChildProcess({ pid: 41 })
    const watch = watchStops(stops)
    watch.track(child)
    watch.end(child)
    expect(watch.stopped()).toBe(false)
  })

  it('looks at the commands it ended until it is released', () => {
    const { stops, ticking } = fakeStops()
    const child = createFakeChildProcess({ pid: 41 })
    const watch = watchStops(stops)
    watch.track(child)
    watch.end(child)
    const during = ticking()
    watch.release()
    expect({ during, after: ticking() }).toEqual({ during: 1, after: 0 })
  })

  it('ends nothing, and starts no interval, for a command that has exited', () => {
    const { stops, asked, intervals } = fakeStops()
    const child = createFakeChildProcess({ pid: 41 })
    const watch = watchStops(stops)
    watch.track(child)
    child.exit(0)
    watch.end(child)
    expect({ asked, intervals }).toEqual({ asked: [], intervals: [] })
  })

  it('ends nothing for a command the system never started', () => {
    const { stops, asked } = fakeStops()
    const unstarted = createFakeChildProcess()
    unstarted.pid = undefined
    const watch = watchStops(stops)
    watch.track(unstarted)
    watch.end(unstarted)
    expect(asked).toEqual([])
  })

  describe('where the host says no way of telling', () => {
    it('sees no stop, and takes commands and a release', () => {
      const watch = watchStops(undefined)
      watch.track(createFakeChildProcess())
      watch.release()
      expect(watch.stopped()).toBe(false)
    })

    it('ends a command through its own process', () => {
      const child = createFakeChildProcess()
      watchStops(undefined).end(child)
      expect(child.kill.mock.calls).toEqual([['SIGTERM']])
    })
  })
})
