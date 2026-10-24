/**
 * The timer functions as they were when this package loaded, before any fake clock replaced
 * them. The waiting helpers schedule on these, so a suite that fakes the clock can still
 * wait on real time.
 */
export const realTimers = {
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  setImmediate: globalThis.setImmediate,
}

/**
 * Resolves after a delay on the real clock, whether or not the fake clock is installed.
 *
 * @param milliseconds - How long to wait.
 * @returns A promise that resolves once the time has passed.
 * @example Giving a real socket time to answer
 * ```ts
 * jest.useFakeTimers()
 * await sleep(20) // => resolves after 20 real milliseconds, the fake clock untouched
 * ```
 */
export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => realTimers.setTimeout(resolve, milliseconds))
}

/**
 * Resolves once every promise callback already queued has run.
 *
 * The promise settles from a real `setImmediate`, which the event loop runs only after the
 * microtask queue is empty, so chains of any length that were pending when it was called
 * have settled by the time it resolves. Faking the clock does not stop it.
 *
 * @returns A promise that resolves on the next turn of the event loop.
 * @example Letting an async handler finish before asserting
 * ```ts
 * emitter.emit('message', frame)
 * await flushPromises()
 * expect(onReply).toHaveBeenCalled()
 * ```
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => realTimers.setImmediate(resolve))
}
