import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { clearTimeout, setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/** Time as the kernel reads it, injected so every timer branch is driven by a spec. */
export interface ServiceClock {
  /** Milliseconds on any monotonic or wall scale; only differences are used. */
  now(): number
  /** Starts a one-shot timer and returns its handle. */
  setTimeout(callback: () => void, ms: number): unknown
  /** Cancels a timer by its handle. */
  clearTimeout(handle: unknown): void
}

/** The injectable boundary of a step that keeps time. */
export interface ClockDeps {
  /** Defaults to `Date.now` and the global timers. */
  readonly clock?: ServiceClock
}

/** The clock a service runs on when none is injected: the wall clock and the global timers, bound when the module loads. */
export const systemClock: ServiceClock = freeze({
  now: () => dateNow(),
  setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms),
  // why: the contract types a handle as opaque, and the only handles this clock is given are the ones it returned
  clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
})
