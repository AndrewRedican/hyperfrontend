import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'

/**
 * Resolve once the process receives an interrupt or terminate signal.
 *
 * Used by long-running services to stay alive after startup and tear down
 * gracefully when the user (or the process supervisor) stops them.
 * It is for a process that starts a server by hand: a service on `runService` never calls it.
 *
 * @returns A promise that settles when `SIGINT` or `SIGTERM` is received.
 *
 * @example Stay alive until the target is stopped
 * ```ts
 * await waitForShutdown()
 * await handle.close()
 * ```
 */
export function waitForShutdown(): Promise<void> {
  return createPromise<void>((resolve) => {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => resolve())
    }
  })
}
