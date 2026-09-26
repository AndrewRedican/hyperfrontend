import type { ReopenOptions, UnresponsivePolicy } from '../shared/types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isFinite, isInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { clearTimeout, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

// note: A frame the browser killed makes no announcement: its beats stop, exactly as a starved frame's do. The policy answers with patience instead of certainty, and only an absence that outlasts the grace a live frame would need to speak again is treated as a death worth acting on.

/** The tuning a revival runs with once every default is applied. */
export type ResolvedReopenOptions = Required<ReopenOptions>

const DEFAULT_REOPEN: ResolvedReopenOptions = { graceMs: 4000, backoff: 3, attempts: 3, stableMs: 60_000 }

/**
 * Reads the reopen tuning out of an unresponsive policy.
 *
 * @param policy - The merged `onUnresponsive` option.
 * @returns The validated tuning with defaults applied, or `null` when the policy is not `reopen`.
 * @throws {Error} When a tuning value is out of range.
 *
 * @example Resolving the shorthand
 * ```typescript
 * resolveReopenPolicy('reopen') // { graceMs: 4000, backoff: 3, attempts: 3, stableMs: 60000 }
 * resolveReopenPolicy('emit') // null
 * ```
 */
export function resolveReopenPolicy(policy: UnresponsivePolicy | undefined): ResolvedReopenOptions | null {
  if (policy === 'reopen') {
    return DEFAULT_REOPEN
  }
  if (typeof policy !== 'object' || policy === null) {
    return null
  }
  const resolved: ResolvedReopenOptions = { ...DEFAULT_REOPEN, ...policy.reopen }
  const { graceMs, backoff, attempts, stableMs } = resolved
  if (!isFinite(graceMs) || graceMs < 0) {
    throw createError(`The reopen policy's "graceMs" must be a finite number of milliseconds of at least 0, but got ${graceMs}.`)
  }
  if (!isFinite(backoff) || backoff < 1) {
    throw createError(`The reopen policy's "backoff" must be a finite factor of at least 1, but got ${backoff}.`)
  }
  if (!isInteger(attempts) || attempts < 1) {
    throw createError(`The reopen policy's "attempts" must be a positive integer, but got ${attempts}.`)
  }
  if (!isFinite(stableMs) || stableMs < 0) {
    throw createError(`The reopen policy's "stableMs" must be a finite number of milliseconds of at least 0, but got ${stableMs}.`)
  }
  return resolved
}

/** What a revival needs from the shell it heals. */
export interface RevivalHooks {
  /** Whether the session is beating right now; a stall that ended reads `true`. */
  isHealthy(): boolean
  /**
   * Replaces the dead mount with a fresh one.
   *
   * @param attempt - The 1-based attempt this reopen spends.
   * @param attempts - The episode's whole budget.
   */
  reopen(attempt: number, attempts: number): void
  /**
   * Stands the feature down for good once the budget is spent.
   *
   * @param attempts - The reopens the episode spent.
   */
  giveUp(attempts: number): void
}

/** One shell's revival policy, fed the session's liveness events. */
export interface Revival {
  /** The watchdog gave its verdict; starts or continues an episode. */
  unresponsive(): void
  /** A session opened; supersedes any pending reopen and arms the stability window. */
  opened(): void
  /**
   * Reports whether silence can be judged right now (`false` while either page
   * is hidden); a return to judgeable releases an attempt held for it with a
   * fresh grace.
   */
  setObservable(observable: boolean): void
  /** A session never completed its handshake; counts as another death if a reopen started it. */
  connectFailed(): void
  /** Releases every timer and forgets any held attempt. */
  dispose(): void
}

/**
 * Creates the policy that brings a feature back after its frame goes silent.
 *
 * Each successive death inside one episode waits longer than the last, and the
 * attempts are capped, because a device that kills the frame every time it
 * returns is saying something no amount of insistence will change. A session
 * that then stays open earns the full budget back: losing a frame to a
 * backgrounded tab is ordinary life on a phone, not a verdict on the feature.
 *
 * @param options - The resolved tuning.
 * @param hooks - The shell seams the policy reads and acts through.
 * @returns The revival handle.
 *
 * @example Wiring a revival into a shell's liveness
 * ```typescript
 * const revival = createRevival(resolveReopenPolicy('reopen'), {
 *   isHealthy: () => monitor.getStatus().state === 'healthy',
 *   reopen: () => mount(),
 *   giveUp: () => teardown(),
 * })
 * ```
 */
export function createRevival(options: ResolvedReopenOptions, hooks: RevivalHooks): Revival {
  let spent = 0
  let grace: ReturnType<typeof setTimeout> | undefined
  let stability: ReturnType<typeof setTimeout> | undefined
  let held = false
  let reopening = false
  let observable = true

  const clearGrace = () => {
    clearTimeout(grace)
    grace = undefined
  }

  const clearStability = () => {
    clearTimeout(stability)
    stability = undefined
  }

  const fire = () => {
    grace = undefined
    if (hooks.isHealthy()) {
      // why: The frame spoke again during the grace, so the verdict was a stall and a reopen now would tear a live session down under whoever is watching it. The budget comes back only once the session has stayed, exactly as after a reopen.
      stability = setTimeout(end, options.stableMs)
      return
    }
    if (!observable) {
      // why: Reopening into a hidden page races throttled timers against the handshake deadline for a frame nobody is watching; the attempt keeps until the page is watched again.
      held = true
      return
    }
    if (spent >= options.attempts) {
      hooks.giveUp(spent)
      return
    }
    spent += 1
    reopening = true
    hooks.reopen(spent, options.attempts)
  }

  const end = () => {
    stability = undefined
    spent = 0
  }

  const schedule = () => {
    // why: A death inside the stability window belongs to the same episode, so the budget keeps counting instead of resetting.
    clearStability()
    if (grace !== undefined || held) {
      return
    }
    grace = setTimeout(fire, options.graceMs * options.backoff ** spent)
  }

  return {
    unresponsive: schedule,
    opened() {
      // why: A session that just opened supersedes any reopen still waiting; firing it would tear the fresh mount down again.
      clearGrace()
      held = false
      reopening = false
      clearStability()
      stability = setTimeout(end, options.stableMs)
    },
    setObservable(next) {
      observable = next
      if (!next || !held) {
        return
      }
      held = false
      // why: A frame that recovered while hidden has not been allowed to say so, because the watchdog grants no health until it hears a beat. The grace runs again from here, and only an absence that survives it is acted on.
      grace = setTimeout(fire, options.graceMs)
    },
    connectFailed() {
      if (!reopening) {
        return
      }
      reopening = false
      schedule()
    },
    dispose() {
      clearGrace()
      clearStability()
      held = false
      reopening = false
    },
  }
}
