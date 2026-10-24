/**
 * A promise together with the functions that settle it, for a test to decide when an
 * awaited operation finishes.
 */
export type Deferred<TValue> = {
  /** The promise to hand to the code under test. */
  promise: Promise<TValue>
  /** Fulfils the promise. */
  resolve(value: TValue | PromiseLike<TValue>): void
  /** Rejects the promise. */
  reject(reason?: unknown): void
  /** Where the promise stands. It changes once the promise has settled, a microtask after `resolve` or `reject`. */
  readonly state: 'pending' | 'fulfilled' | 'rejected'
}

/**
 * Creates a promise the test settles by hand.
 *
 * A rejection is observed by the deferred itself, so rejecting one that the code under test
 * has not awaited yet does not end the run as an unhandled rejection. Code that does await
 * the promise still sees it reject.
 *
 * @returns The deferred, pending.
 * @example Holding an unmount open until the test lets it finish
 * ```ts
 * const exit = createDeferred()
 * const closing = shell.close({ onUnmount: () => exit.promise })
 * expect(shell.isClosing()).toBe(true)
 * exit.resolve()
 * await closing
 * ```
 */
export function createDeferred<TValue = void>(): Deferred<TValue> {
  let state: Deferred<TValue>['state'] = 'pending'
  const settle = {} as Pick<Deferred<TValue>, 'resolve' | 'reject'>
  const promise = new Promise<TValue>((resolve, reject) => Object.assign(settle, { resolve, reject }))
  promise.then(
    () => {
      state = 'fulfilled'
    },
    () => {
      state = 'rejected'
    }
  )
  return {
    promise,
    resolve: settle.resolve,
    reject: settle.reject,
    get state() {
      return state
    },
  }
}
