import type { FakeNpm } from './fake-npm'
import { EventEmitter } from 'node:events'
import { dateParse } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { assign } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { runService } from '@hyperfrontend/server'
import { waitUntil } from '@hyperfrontend/testing'
import { defineStatistics } from '../statistics'

/** The one site the running service lets read it from a browser. */
export const SITE = 'https://site.example'

/** What a spec may change about a run. */
export interface RunOptions {
  /** Environment variables laid over the run's defaults; an undefined value removes the variable */
  env?: Record<string, string | undefined>
  /** The clock the service reads; a fixed instant when omitted */
  now?: () => number
}

/** A statistics service running against a fake npm, with a stand-in for its process. */
export interface RunningStatistics {
  /** The address the service answers on */
  readonly origin: string
  /** Every line the service wrote of its own, to either stream, in order */
  readonly lines: string[]
  /** The lines among them that went to standard error */
  readonly errors: string[]
  /** Asks the service to stop, as its platform would, and resolves with its exit code */
  stop(): Promise<number>
}

/** The outcome of a run that never started. */
export interface RefusedStatistics {
  /** The exit code the runner ended with */
  readonly exitCode: number
  /** Everything the runner wrote to its standard streams */
  readonly output: string
}

/** A run of the statistics service under a stand-in for its process. */
interface Launched {
  /** The exit code of the run, settled once the service has stopped or refused to start */
  exitCode: Promise<number>
  /** Everything the runner wrote to its standard streams, one entry per write */
  written: string[]
  /** Every line the service wrote of its own, to either stream, in order */
  lines: string[]
  /** The lines among them that went to standard error */
  errors: string[]
  /** Sends the stand-in process a signal */
  emit: (signal: string) => void
}

/**
 * Start the runner on the statistics service with a stand-in for the process.
 *
 * @param npm - The npm the service collects from
 * @param options - See {@link RunOptions}
 * @returns The run's exit code, what the runner wrote, the service's own lines, and the stand-in process
 */
function launch(npm: FakeNpm, options: RunOptions): Launched {
  const written: string[] = []
  const lines: string[] = []
  const errors: string[] = []
  const output = {
    write: (text: string, done?: () => void): void => {
      written.push(text)
      done?.()
    },
  }
  const fake = assign(new EventEmitter(), {
    // why: port 0 lets the operating system pick a free port, the loopback interface keeps the listener off the network, no gap between requests keeps a collection of every tracked package within a few milliseconds, and the info level shows the line of every turn
    env: {
      PORT: '0',
      HOST: '127.0.0.1',
      STATISTICS_ALLOWED_ORIGINS: SITE,
      STATISTICS_COLLECT_EVERY: '20ms',
      STATISTICS_REQUEST_GAP: '0ms',
      STATISTICS_LOG_LEVEL: 'info',
      ...options.env,
    },
    platform: process.platform,
    stdout: output,
    stderr: output,
    exit: () => undefined,
  })
  const service = defineStatistics({
    fetch: npm.fetch,
    now: options.now ?? (() => dateParse('2026-09-12T12:00:00.000Z')),
    write: (line) => {
      lines.push(line)
    },
    writeError: (line) => {
      lines.push(line)
      errors.push(line)
    },
  })
  // why: a null build says the service runs from its sources, so no release is looked for beside the spec
  return { exitCode: runService(service, { process: fake, build: null }), written, lines, errors, emit: (signal) => fake.emit(signal) }
}

/**
 * Run the statistics service until a spec stops it.
 *
 * @param npm - The npm the service collects from
 * @param options - See {@link RunOptions}
 * @returns The running service
 * @throws {Error} When the service exits before it has started, with everything it wrote
 *
 * @example
 * ```typescript
 * const running = await runStatistics(createFakeNpm('2026-09-11'))
 * const response = await fetch(new URL('/v1/downloads', running.origin))
 * await running.stop()
 * ```
 */
export async function runStatistics(npm: FakeNpm, options: RunOptions = {}): Promise<RunningStatistics> {
  const run = launch(npm, options)
  let ended: number | undefined
  void run.exitCode.then((code) => {
    ended = code
  })
  const started = await waitUntil(
    () => {
      // why: a service that refuses to boot has said why on its streams, and that is the failure worth reading
      if (ended !== undefined) throw createError(`the service exited with code ${ended} before it started:\n${run.written.join('')}`)
      return run.written.find((line) => line.startsWith('started port='))
    },
    { timeout: 10000 }
  )
  return {
    origin: `http://127.0.0.1:${started.slice('started port='.length).trim()}`,
    lines: run.lines,
    errors: run.errors,
    stop: () => {
      // why: the runner holds the process until the service is stopped; once it has stopped nothing listens for the signal
      run.emit('SIGTERM')
      return run.exitCode
    },
  }
}

/**
 * Run the statistics service for as long as a body of work takes, and stop it whatever the work did.
 *
 * @param npm - The npm the service collects from
 * @param options - See {@link RunOptions}
 * @param work - The work the service is kept running for
 * @returns What the work returned
 *
 * @example
 * ```typescript
 * const status = await whileRunning(createFakeNpm('2026-09-11'), {}, async (running) => (await fetch(new URL('/healthz', running.origin))).status)
 * ```
 */
export async function whileRunning<Result>(
  npm: FakeNpm,
  options: RunOptions,
  work: (running: RunningStatistics) => Promise<Result>
): Promise<Result> {
  const running = await runStatistics(npm, options)
  try {
    return await work(running)
  } finally {
    await running.stop()
  }
}

/**
 * Run the statistics service with an environment it must refuse.
 *
 * @param npm - The npm the service would collect from
 * @param options - See {@link RunOptions}
 * @returns The exit code and what the runner wrote
 *
 * @example
 * ```typescript
 * const refused = await refuseStatistics(createFakeNpm('2026-09-11'), { env: { STATISTICS_ALLOWED_ORIGINS: undefined } })
 * refused.exitCode // 78
 * ```
 */
export async function refuseStatistics(npm: FakeNpm, options: RunOptions): Promise<RefusedStatistics> {
  const run = launch(npm, options)
  return { exitCode: await run.exitCode, output: run.written.join('') }
}
