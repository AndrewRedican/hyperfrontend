/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Creates a wrapper function around a given function to ensure that it can be executed only once.
 * The result of the first execution is stored and returned for all subsequent calls. This makes the function
 * ideal for use cases where a particular operation, such as an initialization or setup, must be performed
 * only once, and its result reused thereafter. This is useful in scenarios like setting up configurations,
 * initializing singletons, or similar one-time operations. The wrapped function is called with the
 * receiver the wrapper was invoked on, so a method wrapped in place keeps its `this`.
 *
 * @param func - The function to be wrapped for single execution.
 * @returns A wrapped version of the input function that executes once and returns the same result for all subsequent calls.
 *
 * @example Single execution initialization
 * ```typescript
 * const initialize = createRunOnceFunction(() => {
 *   console.log('Initializing...')
 *   return { ready: true }
 * })
 * initialize() // logs 'Initializing...', returns { ready: true }
 * initialize() // returns { ready: true } (no re-initialization)
 * ```
 *
 * @example Memoizing a method you do not own
 * ```typescript
 * // a client from a vendor SDK; loadConfig() reads the endpoint it was constructed with
 * const client = { endpoint: 'https://api.example.com', loadConfig() { return fetch(`${this.endpoint}/config`) } }
 * client.loadConfig = createRunOnceFunction(client.loadConfig)
 * const first = client.loadConfig() // one request, made against the client's own endpoint
 * const again = client.loadConfig() // the same promise, no second request
 * first === again // => true
 * ```
 */
export function createRunOnceFunction<T extends (...args: any[]) => any>(func: T): (...args: Parameters<T>) => ReturnType<T> {
  let hasRun = false
  let result: ReturnType<T>
  return function (this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T> {
    if (hasRun) return result
    hasRun = true
    result = func.apply(this, args)
    return result
  }
}
