/**
 * Passes a request to end the process on to the commands it started. A supervisor ends a task by
 * sending the runner a terminate signal, which reaches the runner alone: the platform shell the
 * commands run through, and the commands under it, would go on running without it. On every
 * platform but Windows the runner listens for `SIGTERM` while commands run and sends it to the
 * command and every process below it. A shell that only wraps the command line is told from the
 * command by its name, and is left to end by itself, so the command's exit code comes back
 * through it; it is signalled alone once it has started nothing. Until the run ends the runner
 * looks again four times a second and signals what has appeared since: the next command of a
 * shell line still starts, and is signalled within that time, and one that takes less may
 * finish. A process is signalled once. An interrupt and a hang-up are left alone, since a
 * terminal delivers them to the commands itself, and so is Windows, where a process cannot be
 * sent a terminate signal.
 *
 * @module runner/stops
 */

import type { ProcessSources } from './processes'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { clearInterval, setInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { processSources, runningProcesses, stopTargets } from './processes'

/** The signal passed on to the commands: a request to terminate. */
export type StopSignal = 'SIGTERM'

/** Told that the process was asked to end, and by which signal. */
export type StopListener = (signal: StopSignal) => void

/** How the commands are told that the process was asked to end. */
export interface CommandStops {
  /** Listens for a request to end the process, and answers the function that stops listening. */
  readonly listen: (listener: StopListener) => () => void
  /** Sends a signal to the process a command line was started as and to every process below it, a shell that only wraps the command line being signalled alone once it has started nothing; leaves out the processes named, and answers the ones it signalled. */
  readonly signalStarted: (pid: number, signal: StopSignal, skip?: ReadonlySet<number>) => readonly number[]
  /** Calls a function again and again, a number of milliseconds apart, until the function it answers is called. */
  readonly every: (milliseconds: number, tick: () => void) => () => void
}

/** Where the signals arrive: `process`, unless a test supplies another. */
export interface SignalSource {
  /** Calls a handler each time a signal arrives. */
  on(signal: StopSignal, handler: () => void): unknown
  /** Stops calling a handler. */
  off(signal: StopSignal, handler: () => void): unknown
}

/** What the stops of a process are built from; each is the real one unless given. */
export interface StopsDependencies extends Partial<ProcessSources> {
  /** Where the signals arrive. */
  readonly source?: SignalSource
  /** The platform, which decides whether anything is listened for and where the processes are read from. */
  readonly platform?: string
  /** Sends a process a signal, throwing when there is no such process. */
  readonly kill?: (pid: number, signal: StopSignal) => void
  /** Calls a function on an interval, and answers the function that ends it. */
  readonly every?: CommandStops['every']
}

/** A command a stop can reach: what `spawn` returns, or a stand-in for it. */
export interface StoppableChild {
  /** The process id, or undefined for a command the system never started. */
  readonly pid?: number | undefined
  /** Runs a listener once the command exits. */
  once(event: 'exit', listener: () => void): unknown
  /** Sends the command's own process a signal. */
  kill(signal: StopSignal): unknown
}

/** The commands of one run, and whether the run was asked to stop. */
export interface StopWatch {
  /** Whether the process was asked to end since the run began. */
  readonly stopped: () => boolean
  /** Takes a command just started, which a stop reaches until it exits. */
  readonly track: (child: StoppableChild) => void
  /** Ends a command the run no longer needs: its own process, or the command and everything below it from then on where the host says how. */
  readonly end: (child: StoppableChild) => void
  /** Stops listening and looking, once the commands have ended. */
  readonly release: () => void
}

/** The signal listened for and passed on. */
const SIGNAL: StopSignal = 'SIGTERM'

/** How long after a stop the commands are looked at again for processes not yet signalled, in milliseconds. */
export const RESIGNAL_INTERVAL = 250

/**
 * Calls a function on an interval that does not keep the process running by itself.
 *
 * @param milliseconds - The time between two calls
 * @param tick - The function called
 * @returns The function that ends the interval
 */
function repeat(milliseconds: number, tick: () => void): () => void {
  const interval = setInterval(tick, milliseconds)
  interval.unref()
  return () => clearInterval(interval)
}

/**
 * How this process is told to end, and how it tells the commands it started. On Windows nothing
 * is listened for: Node.js there is ended outright instead of being sent a terminate signal, and
 * a console event reaches every process of the console by itself.
 *
 * @param dependencies - The signal source, the platform, where the processes are read from, `kill` and the interval; each is the real one unless given
 * @returns The stops a commands host is built with
 *
 * @example A host whose commands end with the runner
 * ```typescript
 * import { spawn } from 'node:child_process'
 *
 * await runCommands({ command: 'node dist/apps/api/main.cjs' }, [], {
 *   root,
 *   env: process.env,
 *   platform: process.platform,
 *   execPath: process.execPath,
 *   spawn: (line, options) => spawn(line, options),
 *   write: (line) => process.stderr.write(`${line}\n`),
 *   stops: processStops(),
 * })
 * // => `kill -TERM` of this process now reaches the node process and every process it started, and the run answers once they have ended
 * ```
 */
export function processStops(dependencies: StopsDependencies = {}): CommandStops {
  const source = dependencies.source ?? process
  const platform = dependencies.platform ?? process.platform
  const kill = dependencies.kill ?? ((pid: number, signal: StopSignal): void => void process.kill(pid, signal))
  const sources = processSources(dependencies)
  return {
    listen: (listener) => {
      if (platform === 'win32') return () => undefined
      const handler = (): void => listener(SIGNAL)
      source.on(SIGNAL, handler)
      return () => void source.off(SIGNAL, handler)
    },
    signalStarted: (pid, signal, skip) => {
      return stopTargets(pid, runningProcesses(platform, sources)).filter((target) => {
        if (skip?.has(target) === true) return false
        try {
          kill(target, signal)
          return true
        } catch {
          // why: a process that ended between the listing and the signal has nothing left to stop
          return false
        }
      })
    },
    every: dependencies.every ?? repeat,
  }
}

/**
 * Watches for a stop on behalf of one run of commands. Once the process is asked to end, every
 * command it was given is sent the signal, and until the watch is released the commands are
 * looked at again on an interval, so that a process started below them afterwards is sent it
 * too. A command the run ends itself is signalled and looked at in the same way, alone. A
 * process is sent the signal once.
 *
 * @param stops - How the commands are told; without it nothing is listened for and no stop is ever seen
 * @returns The watch: whether a stop was asked for, how a command joins it, how one is ended, and how the watch ends
 *
 * @example Watching the one command of a run
 * ```typescript
 * const watch = watchStops(processStops())
 * const child = spawn('node server.js', { shell: true, stdio: 'inherit' })
 * watch.track(child)
 * child.once('close', () => watch.release())
 * // => a terminate signal sent to this process reaches `node server.js`, and watch.stopped() answers true from then on
 * ```
 */
export function watchStops(stops: CommandStops | undefined): StopWatch {
  if (stops === undefined)
    return { stopped: () => false, track: () => undefined, end: (child) => void child.kill(SIGNAL), release: () => undefined }
  const running = createSet<number>()
  const ending = createSet<number>()
  const signalled = createSet<number>()
  let stopped = false
  let cancel: (() => void) | undefined
  const reach = (pid: number): void => {
    for (const reached of stops.signalStarted(pid, SIGNAL, signalled)) signalled.add(reached)
  }
  const look = (): void => {
    for (const pid of running) if (stopped || ending.has(pid)) reach(pid)
  }
  const keepLooking = (): void => {
    cancel ??= stops.every(RESIGNAL_INTERVAL, look)
  }
  const unlisten = stops.listen(() => {
    stopped = true
    look()
    keepLooking()
  })
  return {
    stopped: () => stopped,
    track: (child) => {
      const { pid } = child
      if (pid === undefined) return
      running.add(pid)
      child.once('exit', () => running.delete(pid))
    },
    end: (child) => {
      if (child.pid === undefined || !running.has(child.pid)) return
      ending.add(child.pid)
      reach(child.pid)
      keepLooking()
    },
    release: () => {
      unlisten()
      cancel?.()
    },
  }
}
