import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { setTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/**
 * Narrowed view of `globalThis` exposing the optional manual-GC entry point.
 */
interface GlobalWithGc {
  /** Manual GC entry point exposed when Node.js runs with `--expose-gc`. */
  gc?: () => void
}

/**
 * Yields control to the event loop and triggers a manual garbage-collection cycle when
 * `globalThis.gc` is available (Node.js started with `--expose-gc`).
 *
 * This is the always-on free utility companion to the opt-in memory monitor. Call it
 * between memory-heavy phases to drain pending I/O microtasks and reclaim transient
 * allocations before the next phase begins.
 *
 * @returns A promise that resolves after one macrotask tick, post-GC if available.
 *
 * @example Yielding between heavy build phases
 * ```typescript
 * await runBundlePhase(ctx, config)
 * await recover()
 * await runPackagePhase(ctx, config)
 * ```
 */
export const recover = (): Promise<void> =>
  createPromise<void>((resolve) => {
    setTimeout(() => {
      const gc = (<GlobalWithGc>globalThis).gc
      if (typeof gc === 'function') gc()
      resolve()
    }, 0)
  })
