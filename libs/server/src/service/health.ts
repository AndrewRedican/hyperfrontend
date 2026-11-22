import type { ClockDeps, ServiceClock } from './clock'
import type { BaseContext, Step, StepResult } from './contract'
import { createError, createTypeError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { isInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { entries, fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise, promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { systemClock } from './clock'
import { isPlainObject } from './headers'
import { httpError } from './http-error'
import { jsonResponse } from './responses'
import { isStaticPattern } from './route-pattern'

/** Options of the liveness step. */
export interface HealthOptions {
  /** The path answered; `/healthz` when omitted. */
  readonly path?: string
}

/** Options of the readiness step. */
export interface ReadinessOptions {
  /** The path answered; `/readyz` when omitted. */
  readonly path?: string
  /** Checks keyed by name. A check is ready only when it returns or resolves `true`; its signal aborts at the timeout. One run of a check serves every probe that arrives while it is pending. A name is public, since the response lists it: it says what a probe may know and nothing more. */
  readonly checks?: Readonly<Record<string, (signal: AbortSignal) => boolean | Promise<boolean>>>
  /** Time allowed to each check, in milliseconds; 2000 when omitted. */
  readonly timeoutMs?: number
}

/** One check of a readiness step: it says whether a dependency is ready, and may stop asking when its signal aborts. */
type ReadinessCheck = (signal: AbortSignal) => boolean | Promise<boolean>

/** The options of a readiness step, checked and defaulted. */
interface ReadinessPlan {
  /** The path answered. */
  readonly path: string
  /** Time allowed to each run of a check, in milliseconds. */
  readonly timeoutMs: number
  /** The checks with their names, in declaration order. */
  readonly checks: readonly (readonly [string, ReadinessCheck])[]
}

// note: A check name is a key of the response body, so it is a short word a monitor can match on.
const CHECK_NAME = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/

// note: The longest delay a timer keeps; a longer one would fire at once.
const LONGEST_TIMEOUT = 2147483647

/**
 * Builds a step that answers `GET` and `HEAD` on one fixed path and leaves every other path to the rest of the pipeline.
 *
 * @param path - The canonical path the probe is asked on.
 * @param answer - Builds the response to one probe, from the context of its request.
 * @returns The step: it delegates another path and refuses another method with 405 and `Allow: GET, HEAD`.
 */
function probeStep(path: string, answer: (context: BaseContext) => StepResult): Step {
  return (request, context, next) => {
    if (request.path !== path) {
      return next()
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      throw httpError(405, 'method-not-allowed', { Allow: 'GET, HEAD' })
    }
    return answer(context)
  }
}

/**
 * Liveness: `GET` and `HEAD` on the path answer 200 `ok` while the process runs. It touches no dependency. Other paths delegate. Throws at construction for a path that is not a static pattern.
 * Put it first among a service's steps, ahead of any limiter or identity step, so that a probe is answered whatever else is happening. Nothing else exempts a probe from a step ahead of it.
 * A probe is a step, not a route, so each one is reported as a request event that carries its path, and `readiness` is reported the same way; a service that does not want probes in its log leaves them out in its `report` function.
 *
 * @param options - The path answered; `/healthz` when omitted.
 * @returns The step. Its answer is never stored: `Cache-Control: no-store`.
 * @throws {TypeError} For a path with a param, a wildcard, a trailing slash or no leading slash.
 *
 * @example Answering a platform's liveness probe ahead of everything else
 * ```typescript
 * import { health, startService } from '@hyperfrontend/server'
 *
 * const service = await startService({ port: 8080, steps: [health(), requireIdentity, api] })
 * // GET /healthz answers 200 "ok" without a credential, and POST /healthz answers 405 with Allow: GET, HEAD
 * ```
 *
 * @example Moving the probe under a prefix a proxy keeps private
 * ```typescript
 * import { health } from '@hyperfrontend/server'
 *
 * const liveness = health({ path: '/internal/live' })
 * // GET /healthz now goes to the next step
 * ```
 *
 * @example Keeping answered probes out of the log
 * ```typescript
 * import { formatEvent, health, startService } from '@hyperfrontend/server'
 *
 * const service = await startService(
 *   { port: 8080, steps: [health(), api] },
 *   {
 *     report: (event) => {
 *       if (event.type === 'request' && event.path === '/healthz' && event.outcome === 'sent') return
 *       process.stdout.write(`${formatEvent(event)}\n`)
 *     },
 *   }
 * )
 * // a probe that was answered writes no line; one that was cut short, and every failure event, still does
 * ```
 */
export function health(options?: HealthOptions): Step {
  const { path = '/healthz' } = options ?? {}
  if (!isStaticPattern(path)) {
    throw createTypeError('health: "path" must be a static pattern such as "/healthz".')
  }
  return probeStep(path, () => ({
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    body: Buffer.from('ok'),
  }))
}

/**
 * Lists what is wrong with the checks of a readiness step.
 *
 * @param checks - The value given as the checks, which no compiler need have seen.
 * @returns One line per problem: per check in declaration order, a value that is no function and then a faulty name.
 */
function checkProblems(checks: unknown): string[] {
  // why: a Map or an array has no check among its own keys, and would otherwise make a service that asks nothing and always answers ready
  if (!isPlainObject(checks)) {
    return ['"checks" must be a plain object of functions.']
  }
  return entries(checks).flatMap(([name, check]) => [
    ...(typeof check === 'function' ? [] : [`"checks.${name}" must be a function.`]),
    ...(CHECK_NAME.test(name)
      ? []
      : [
          `"checks.${name}": a check name must be 1 to 64 characters of letters, digits, ".", "_", ":" or "-", starting with a letter or digit.`,
        ]),
  ])
}

/**
 * Checks the options of a readiness step and fills in what was omitted.
 *
 * @param options - The options as given, which no compiler need have seen.
 * @returns The path, the timeout and the checks in declaration order.
 * @throws {Error} Once, naming the faulty path, the faulty timeout, then every fault of the checks.
 */
function planReadiness(options: ReadinessOptions | undefined): ReadinessPlan {
  const { path = '/readyz', timeoutMs = 2000, checks = {} } = options ?? {}
  const problems: string[] = [
    ...(isStaticPattern(path) ? [] : ['"path" must be a static pattern such as "/readyz".']),
    ...(isInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= LONGEST_TIMEOUT ? [] : ['"timeoutMs" must be a positive integer.']),
    ...checkProblems(checks),
  ]
  if (problems.length > 0) {
    throw createError(['Invalid readiness options:', ...problems.map((problem) => `  - ${problem}`)].join('\n'))
  }
  return { path, timeoutMs, checks: entries(checks) }
}

/**
 * Starts one run of a check: it calls the check with a signal of the run's own and bounds the wait on the clock.
 * A run that passes its timeout answers `false` and aborts its signal; what the check gives later is ignored, and a late rejection is dropped.
 *
 * @param check - The check to call.
 * @param timeoutMs - Time allowed to the run, in milliseconds.
 * @param clock - The clock the timer runs on.
 * @param context - The context of the probe that starts the run; a check that throws or rejects in time is reported on it.
 * @param settled - Called once when the check has returned, thrown, resolved or rejected, however late.
 * @returns A promise for whether the check is ready. It never rejects.
 */
function startRun(
  check: ReadinessCheck,
  timeoutMs: number,
  clock: ServiceClock,
  context: BaseContext,
  settled: () => void
): Promise<boolean> {
  const controller = new AbortController()
  return createPromise<boolean>((resolve) => {
    let expired = false
    const timer = clock.setTimeout(() => {
      expired = true
      controller.abort()
      resolve(false)
    }, timeoutMs)
    const finish = (ready: boolean): void => {
      settled()
      if (!expired) {
        clock.clearTimeout(timer)
        resolve(ready)
      }
    }
    // why: the check runs inside a promise so that a throw and a rejection arrive the same way, and so that both always have a handler
    createPromise<unknown>((answer) => answer(check(controller.signal))).then(
      (value) => finish(value === true),
      (error: unknown) => {
        if (!expired) {
          context.report('readiness-check-failed', error)
        }
        finish(false)
      }
    )
  })
}

/**
 * Readiness: 200 when every check is ready, else 503. The body lists check names and booleans only. Other paths delegate. Throws once at construction, naming every invalid option.
 * The checks are asked together, and a check is ready only when it returns or resolves exactly `true`. One run of a check serves every probe that arrives while it is pending;
 * a settled result is never reused. A check that throws or rejects counts as not ready and is reported as `readiness-check-failed`. A run that passes the timeout counts as not ready
 * and its signal aborts; until that run settles the check is not called again, so a dependency that hangs costs one pending call, not one per probe.
 * Like `health`, it goes first among a service's steps, ahead of any limiter or identity step: nothing else exempts a probe.
 *
 * @param options - The path, the checks and the time allowed to each; `/readyz`, no check and 2000 ms when omitted.
 * @param deps - The clock the timeout runs on; the system clock when omitted.
 * @returns The step. Its answer is JSON, `{ "ready": boolean, "checks": { "<name>": boolean } }`, and is never stored.
 * @throws {Error} `Invalid readiness options:` and one line per problem of the path, the timeout and each check.
 *
 * @example Reporting ready once a first refresh has landed and the store answers
 * ```typescript
 * import { readiness } from '@hyperfrontend/server'
 *
 * let refreshed = false
 * const ready = readiness({ checks: { refreshed: () => refreshed, store: (signal) => pingStore(signal) }, timeoutMs: 1000 })
 * // GET /readyz answers 503 {"ready":false,"checks":{"refreshed":false,"store":true}} until the first refresh,
 * // and a store that has not answered within a second counts as false and has its signal aborted
 * ```
 *
 * @example Driving the timeout from a spec
 * ```typescript
 * import type { ServiceClock } from '@hyperfrontend/server'
 * import { readiness } from '@hyperfrontend/server'
 *
 * const timers: (() => void)[] = []
 * const clock: ServiceClock = { now: () => 0, setTimeout: (callback) => timers.push(callback), clearTimeout: () => undefined }
 * const ready = readiness({ checks: { store: () => new Promise<boolean>(() => undefined) } }, { clock })
 * // after a probe is sent, timers[0]() answers it 503 without waiting two seconds
 * ```
 */
export function readiness(options?: ReadinessOptions, deps?: ClockDeps): Step {
  const { path, timeoutMs, checks } = planReadiness(options)
  const clock = deps?.clock ?? systemClock
  const runs = createMap<string, Promise<boolean>>()
  const ask = (name: string, check: ReadinessCheck, context: BaseContext): Promise<boolean> => {
    // how: a run stays here from its start until its check settles, so a probe joins a pending run and reads `false` from one that timed out
    const pending = runs.get(name)
    if (pending !== undefined) {
      return pending
    }
    const started = startRun(check, timeoutMs, clock, context, () => void runs.delete(name))
    runs.set(name, started)
    return started
  }
  return probeStep(path, (context) =>
    promiseAll(checks.map(([name, check]) => ask(name, check, context))).then((results) => {
      const ready = results.every((result) => result)
      return jsonResponse(
        ready ? 200 : 503,
        { ready, checks: fromEntries(checks.map(([name], index) => [name, results[index]])) },
        { 'Cache-Control': 'no-store' }
      )
    })
  )
}
