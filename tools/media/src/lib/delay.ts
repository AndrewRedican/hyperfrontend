import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { setTimeout as scheduleTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/**
 * Wait for a fixed period.
 *
 * Used for the deliberate pauses a recording needs, never for waiting on a
 * page to become ready: a delay long enough on one machine is short on another
 * and the failure is a silently empty recording.
 *
 * @param ms - How long to wait.
 * @returns A promise that settles once the period has passed.
 */
export function delay(ms: number): Promise<void> {
  return createPromise<void>((resolve) => {
    scheduleTimeout(resolve, ms)
  })
}
