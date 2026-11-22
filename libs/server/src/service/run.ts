import type { EnvironmentContract, EnvironmentRecord, EnvironmentShape, EnvironmentValues } from '../environment/contract'
import type { ReleaseFileSystem } from '../manifest/release-files'
import type { ClockDeps } from './clock'
import type { ServiceEvent } from './events'
import type { ServiceBuildStamp } from './run-build'
import type { FatalCause, FatalFields } from './run-lines'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise, promiseReject, promiseResolve } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { systemClock } from './clock'
import { errorName, formatEvent } from './events'
import { checkRelease, freezeDeep, immutableDigest, readStamp } from './run-build'
import { FAULT_LIMIT, FLUSH_MS, FORCE_AFTER_MS, HOLD_MS, isStartedService, readDefinition } from './run-definition'
import {
  bootMessage,
  fatalBlock,
  faultFields,
  issueLines,
  listLines,
  SECTION_DIFFERS,
  stackFrames,
  startedLine,
  STOPPED_LINE,
  stoppingLine,
  UNUSABLE_START,
} from './run-lines'

/** A JSON value: what an immutable section is made of. */
export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue }

/** What a start function receives besides its values. Frozen. */
export interface RunContext {
  /** Aborts when the service is asked to stop, before `close()` is called: on a signal, a closed IPC channel, a fault, or a start that ran out of time. A service ends its own timers and work in flight on it. Work that waits on it is rejected when it aborts, and a rejection nobody handles is a fault, which makes every stop exit with code 1: catch it. */
  readonly signal: AbortSignal
  /** Writes an event to standard output as one `formatEvent` line. Hand it to `startService` as `deps.report`. It takes events only: a line of the service's own is the service's to write, as a whole line that starts with none of the words `started`, `stopping`, `stopped` and `fatal`. */
  readonly report: (event: ServiceEvent) => void
}

/** What a start function resolves to: something that can be stopped. A `ServiceHandle` is one. */
export interface StartedService {
  /** The port the service listens on, 1 to 65535, printed in the started line. A service without a listener omits it. */
  readonly port?: number
  /** Stops everything the service started, in the service's own order, and resolves when it has stopped. Called at most once. A service stops in this order: its own timers, then its own work in flight, aborted and awaited, then the `ServiceHandle`, whose `close()` waits for exchanges only. */
  close(): Promise<void>
}

/** A service as `runService` runs it. */
export interface ServiceDefinition<Shape extends EnvironmentShape> {
  /** The environment the service reads. It is checked before `start` runs, and `start` receives its values. */
  readonly environment: EnvironmentContract<Shape>
  /** Builds and starts the service from valid values. It runs once. The runner can close only what it resolves: when it fails after it acquired something, it releases that before it throws. */
  readonly start: (values: EnvironmentValues<Shape>, context: RunContext) => StartedService | Promise<StartedService>
  /** The immutable section the service runs with: a JSON value. The runner freezes it, and a built service refuses to boot when it is not the section it was built with. Write it as a literal or type it with a `type` alias: TypeScript does not accept an `interface` as a JSON object type. */
  readonly immutable?: JsonValue
  /** Time allowed for `start` to settle, in milliseconds; 30000 when omitted. When it runs out the service is stopped as while booting: the signal aborts and `start` has `stopTimeoutMs` to settle. */
  readonly startTimeoutMs?: number
  /** Time allowed from the first cause to stop until `close()` has settled, in milliseconds; 15000 when omitted. Keep it above the service's `graceMs`. */
  readonly stopTimeoutMs?: number
}

/** A stream the runner writes lines to. `process.stdout` is one. */
export interface ProcessOutput {
  /** Writes text and calls `done` once the text has been handed to the operating system. */
  write(text: string, done?: () => void): unknown
}

/** The process as the runner uses it. The global `process` is one; a spec passes a fake. */
export interface ServiceProcess {
  /** The environment the contract is checked against. */
  readonly env: EnvironmentRecord
  /** The platform name; `win32` adds the `SIGBREAK` listener. */
  readonly platform: string
  /** Where the started, stopping and stopped lines and the events go. */
  readonly stdout: ProcessOutput
  /** Where fatal lines go. */
  readonly stderr: ProcessOutput
  /** Adds a listener for a signal, `disconnect`, `uncaughtException` or `unhandledRejection`. */
  on(event: string, listener: (...values: unknown[]) => void): unknown
  /** Removes a listener `on` added. */
  removeListener(event: string, listener: (...values: unknown[]) => void): unknown
  /** Ends the process with the code. */
  exit(code: number): unknown
}

/** Injectable boundaries of the runner, defaulted for production. */
export interface RunDeps extends ClockDeps {
  /** The process; the global `process` when omitted. */
  readonly process?: ServiceProcess
  /** The build stamp; read from `globalThis` when omitted. `null` says the service runs from source. */
  readonly build?: ServiceBuildStamp | null
  /** File access for the release check of a built service; the file system when omitted. */
  readonly files?: ReleaseFileSystem
}

/** Where a run stands: before its started line, after it, between a cause to stop and the exit, or flushing its streams on the way out. */
type Phase = 'booting' | 'running' | 'stopping' | 'exiting'

/** A listener the runner installed, and the event it listens for. */
type Installed = readonly [event: string, listener: (...values: unknown[]) => void]

/**
 * Returns the definition as given. It exists for inference: `start` gets its values typed from `environment` wherever the definition is written.
 * It neither validates nor freezes: `runService` is the one place where a definition is judged.
 *
 * @param definition - The environment, the start function and the bounds of a service.
 * @returns The same object.
 *
 * @example The whole of a service, in the file its main imports
 * ```typescript
 * import { defineService, health, startService } from '@hyperfrontend/server'
 * import { asPort, defineEnvironment, optional } from '@hyperfrontend/server/environment'
 *
 * export const service = defineService({
 *   environment: defineEnvironment({ http: { PORT: optional(asPort({ allowZero: true }), 8080) } }),
 *   start: (values, context) => startService({ port: values.http.PORT, steps: [health()] }, { report: context.report }),
 * })
 * ```
 */
export function defineService<Shape extends EnvironmentShape>(definition: ServiceDefinition<Shape>): ServiceDefinition<Shape> {
  return definition
}

/**
 * Picks the process a run acts on.
 *
 * @param deps - The boundaries `runService` was given.
 * @returns The injected process, or the global `process` when none was.
 *
 * @example A run over a fake and a run over the real thing
 * ```typescript
 * processOf({ process: fake }) // => fake
 * processOf({}) // => process
 * ```
 */
export function processOf(deps: RunDeps): ServiceProcess {
  return deps.process ?? process
}

/**
 * Runs a service as the whole of a process: checks a built release, loads the environment, starts, prints the started line, waits for a cause to stop, stops, and ends the process.
 * It resolves with the exit code after asking the process to exit with it, and never rejects. It is the only function of the kernel that installs fault and `disconnect` listeners on the process, and it holds the process until it ends it; `waitForShutdown` must not be used beside it, and a process runs one runner.
 * While a service runs it keeps one timer pending on the clock, so a spec on the real clock stops the service it started, or its process stays alive.
 *
 * @param definition - The service: its environment, its start function, and optionally its immutable section and its two times.
 * @param deps - The process, the clock, the build stamp and the file system; the real ones when omitted.
 * @returns A promise for the exit code: 0 for a stop that was asked for and closed with no fault, 78 for a release, a section or an environment this deployment cannot start with, 1 for everything else.
 *
 * @example The whole main of a service
 * ```typescript
 * import { runService } from '@hyperfrontend/server'
 * import { service } from './service'
 *
 * void runService(service)
 * // standard output: started port=8080
 * // on SIGTERM:      stopping cause=signal signal=SIGTERM, then stopped, and exit code 0
 * ```
 *
 * @example Driving a service whole in a spec, without touching the process
 * ```typescript
 * import { EventEmitter } from 'node:events'
 * import { defineService, runService } from '@hyperfrontend/server'
 * import { defineEnvironment } from '@hyperfrontend/server/environment'
 *
 * const lines: string[] = []
 * const output = { write: (text: string, done?: () => void) => (lines.push(text), done?.()) }
 * const fake = Object.assign(new EventEmitter(), { env: {}, platform: 'linux', stdout: output, stderr: output, exit: () => undefined })
 * const job = defineService({ environment: defineEnvironment({}), start: () => ({ close: async () => undefined }) })
 * const code = runService(job, { process: fake, build: null })
 * await new Promise((resolve) => setImmediate(resolve))
 * fake.emit('SIGTERM')
 * await code // 0, with lines: 'started\n', 'stopping cause=signal signal=SIGTERM\n', 'stopped\n', '', ''
 * ```
 */
export function runService<Shape extends EnvironmentShape>(definition: ServiceDefinition<Shape>, deps: RunDeps = {}): Promise<number> {
  const proc = processOf(deps)
  const clock = deps.clock ?? systemClock
  // why: the definition is read once and behind a guard, so a getter that throws ends the run as a fatal block and never as a rejection
  const reading = readDefinition<Shape>(definition)
  const service = reading.service
  const controller = new AbortController()
  const installed: Installed[] = []
  let phase: Phase = 'booting'
  let started: StartedService | null = null
  let stopCode = 0
  let stoppingSince = 0
  let stopFaults = 0
  let lastFault: readonly [unknown] | null = null
  let timer: readonly [unknown] | null = null
  return createPromise<number>((resolve) => {
    const print = (stream: 'stdout' | 'stderr', text: string): void => {
      try {
        proc[stream].write(text)
      } catch {
        // why: a stream that throws on a write is closed, and a line that cannot be written must not become a fault of the runner
      }
    }
    const disarm = (): void => {
      if (timer !== null) {
        clock.clearTimeout(timer[0])
        timer = null
      }
    }
    // how: the phases follow one another and each has one timer, so the runner keeps one pending from the start to the exit and nothing else
    const arm = (fire: () => void, ms: number): void => {
      disarm()
      timer = [
        clock.setTimeout(() => {
          timer = null
          fire()
        }, ms),
      ]
    }
    const exit = (code: number, block?: string): void => {
      if (phase === 'exiting') {
        return
      }
      phase = 'exiting'
      let left = false
      const leave = (): void => {
        if (!left) {
          left = true
          disarm()
          // why: the listeners stay through the flush, so a signal or a fault that arrives during it is ignored here and never falls to Node's defaults
          installed.forEach(([event, listener]) => proc.removeListener(event, listener))
          proc.exit(code)
          resolve(code)
        }
      }
      const flushErrors = (): void => {
        try {
          proc.stderr.write('', leave)
        } catch {
          leave()
        }
      }
      // why: a reader that stopped reading never lets the callbacks arrive, and the process must still end
      arm(leave, FLUSH_MS)
      if (block !== undefined) {
        print('stderr', block)
      }
      try {
        proc.stdout.write('', flushErrors)
      } catch {
        flushErrors()
      }
    }
    const fatal = (cause: FatalCause, fields: FatalFields, detail: readonly string[], code: number): void =>
      exit(code, fatalBlock(cause, fields, detail))
    const close = (service: StartedService): void => {
      let closing: Promise<unknown>
      try {
        closing = promiseResolve(service.close())
      } catch (error) {
        closing = promiseReject(error)
      }
      closing.then(
        () => {
          if (phase !== 'exiting') {
            print('stdout', STOPPED_LINE)
            exit(stopCode)
          }
        },
        (error: unknown) => fatal('stop-failed', faultFields(error), stackFrames(error), 1)
      )
    }
    const stop = (line: string, code: number): void => {
      phase = 'stopping'
      stopCode = code
      stoppingSince = clock.now()
      print('stdout', line)
      controller.abort()
      // how: arming the stop timer clears the start timer or the hold, whichever was pending
      arm(() => fatal('stop-timeout', {}, [], 1), reading.stopTimeoutMs)
      // how: a service that was running is closed now, and one that was booting when its start settles
      if (started !== null) {
        close(started)
      }
    }
    const onSignal = (signal: string): void => {
      if (phase === 'booting' || phase === 'running') {
        stop(stoppingLine('signal', signal), 0)
      } else if (clock.now() - stoppingSince >= FORCE_AFTER_MS) {
        // how: once the exit began this writes nothing and changes nothing, as for every other ending
        fatal('forced', { signal }, [], 1)
      }
    }
    const onFault = (cause: 'uncaught-exception' | 'unhandled-rejection', value: unknown): void => {
      // why: under --unhandled-rejections=strict Node hands one rejection to the uncaughtException listener and then to the unhandledRejection listener
      if (phase === 'exiting' || (lastFault !== null && Object.is(lastFault[0], value))) {
        return
      }
      lastFault = [value]
      if (phase === 'stopping') {
        // why: a fault while stopping costs the clean exit code and nothing else, so requests in flight keep their grace under the stop timer
        stopCode = 1
        stopFaults += 1
        // why: with standard error closed every block comes back as one more fault, so only the first few are written
        if (stopFaults <= FAULT_LIMIT) {
          print('stderr', fatalBlock(cause, faultFields(value), stackFrames(value)))
        }
        return
      }
      // why: a message can quote a request once requests are served, so it is printed only ahead of the started line
      print('stderr', fatalBlock(cause, faultFields(value), [...(phase === 'booting' ? bootMessage(value) : []), ...stackFrames(value)]))
      stop(stoppingLine('fault'), 1)
    }
    const listen = (event: string, listener: (...values: unknown[]) => void): void => {
      installed.push([event, listener])
      proc.on(event, listener)
    }

    if (service === null) {
      return fatal('definition', reading.fields, reading.detail, 1)
    }
    for (const signal of proc.platform === 'win32' ? ['SIGINT', 'SIGTERM', 'SIGBREAK'] : ['SIGINT', 'SIGTERM']) {
      listen(signal, () => onSignal(signal))
    }
    listen('disconnect', () => {
      if (phase === 'booting' || phase === 'running') {
        stop(stoppingLine('disconnect'), 0)
      }
    })
    listen('uncaughtException', (error, origin) =>
      onFault(origin === 'unhandledRejection' ? 'unhandled-rejection' : 'uncaught-exception', error)
    )
    listen('unhandledRejection', (reason) => onFault('unhandled-rejection', reason))

    const stamp = deps.build === undefined ? (readStamp(globalThis) ?? null) : deps.build
    let release: string | null = null
    if (stamp !== null) {
      const checked = checkRelease(stamp, deps.files)
      if (checked.issues.length > 0) {
        return fatal('release', checked.fields, checked.issues, 78)
      }
      if (service.immutable !== undefined && immutableDigest(service.immutable) !== checked.immutable) {
        return fatal('immutable', {}, listLines([SECTION_DIFFERS]), 78)
      }
      release = checked.release
    }
    try {
      freezeDeep(service.immutable)
    } catch (error) {
      // why: an accessor of the section may throw and a section may nest deeper than the stack, and neither is a fault of a service that never started
      return fatal('definition', { name: errorName(error) }, [], 1)
    }
    let values: EnvironmentValues<Shape>
    try {
      const issues = service.environment.check(proc.env)
      if (issues.length > 0) {
        // why: the block is written from the structured issues, which carry no value, and never from a thrown message
        return fatal('environment', {}, issueLines(issues), 78)
      }
      values = service.environment.load(proc.env)
    } catch (error) {
      return fatal('environment', { name: errorName(error) }, [], 78)
    }
    const context: RunContext = freeze({
      signal: controller.signal,
      report: (event: ServiceEvent): void => {
        if (phase !== 'exiting') {
          try {
            proc.stdout.write(`${formatEvent(event)}\n`)
          } catch {
            // why: a sink never fails the exchange that reported to it, whether the event or the stream is at fault
          }
        }
      },
    })
    arm(() => {
      // why: a start that ran out of time is a stop while booting, so it gets the signal and the stop time to release what it opened
      print('stderr', fatalBlock('start-timeout', {}, []))
      stop(stoppingLine('start-timeout'), 1)
    }, reading.startTimeoutMs)
    const hold = (): void => arm(hold, HOLD_MS)
    // why: the start runs inside a promise so that a throw and a rejection arrive the same way
    createPromise<unknown>((settle) => settle(service.start(values, context))).then(
      (value) => {
        if (phase === 'exiting') {
          return
        }
        if (!isStartedService(value)) {
          // why: a start that fails after it was told to stop is not a second failure
          return phase === 'stopping' ? exit(stopCode) : fatal('start-failed', { name: 'TypeError' }, [UNUSABLE_START], 1)
        }
        if (phase === 'stopping') {
          return close(value)
        }
        started = value
        phase = 'running'
        // why: nothing of the runner's would hold the event loop while a service runs, and one with no listener would end with code 0 unasked
        hold()
        print('stdout', startedLine(value.port, release))
      },
      (error: unknown) =>
        phase === 'stopping' ? exit(stopCode) : fatal('start-failed', faultFields(error), [...bootMessage(error), ...stackFrames(error)], 1)
    )
  })
}
