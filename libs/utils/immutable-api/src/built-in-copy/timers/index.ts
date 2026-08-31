/**
 * Safe copies of Timer/Scheduling built-in functions.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/timers
 */

const _setTimeout = globalThis.setTimeout
const _setInterval = globalThis.setInterval
const _clearTimeout = globalThis.clearTimeout
const _clearInterval = globalThis.clearInterval
const _queueMicrotask = globalThis.queueMicrotask
const _requestAnimationFrame = typeof globalThis.requestAnimationFrame === 'function' ? globalThis.requestAnimationFrame : undefined
const _cancelAnimationFrame = typeof globalThis.cancelAnimationFrame === 'function' ? globalThis.cancelAnimationFrame : undefined
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Sets a timer which executes a function once the timer expires.
 *
 * @param callback - Function to call when the timer elapses.
 * @param delay - Time in milliseconds before executing.
 * @param args - Additional arguments to pass to the callback.
 * @returns A numeric ID for the timer.
 *
 * @example Setting a timeout
 * ```typescript
 * const timerId = setTimeout(() => console.log('Executed'), 1000)
 * // Pass arguments to callback
 * setTimeout((name, count) => console.log(name, count), 500, 'items', 5)
 * ```
 */
export const setTimeout = <TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay?: number,
  ...args: TArgs
): ReturnType<typeof globalThis.setTimeout> => _setTimeout(callback, delay, ...args)

/**
 * (Safe copy) Repeatedly calls a function with a fixed time delay between each call.
 *
 * @param callback - Function to call at each interval.
 * @param delay - Time in milliseconds between calls.
 * @param args - Additional arguments to pass to the callback.
 * @returns A numeric ID for the interval.
 *
 * @example Setting an interval
 * ```typescript
 * let count = 0
 * const intervalId = setInterval(() => {
 *   count++
 *   if (count >= 5) clearInterval(intervalId)
 * }, 1000)
 * ```
 */
export const setInterval = <TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay?: number,
  ...args: TArgs
): ReturnType<typeof globalThis.setInterval> => _setInterval(callback, delay, ...args)

/**
 * (Safe copy) Cancels a timeout previously established by setTimeout.
 *
 * @param id - The identifier of the timeout to cancel.
 *
 * @example Canceling a timeout
 * ```typescript
 * const timerId = setTimeout(() => console.log('Never runs'), 5000)
 * clearTimeout(timerId)
 * ```
 */
export const clearTimeout = (id: ReturnType<typeof globalThis.setTimeout> | undefined): void => {
  _clearTimeout(id)
}

/**
 * (Safe copy) Cancels a timed, repeating action previously established by setInterval.
 *
 * @param id - The identifier of the interval to cancel.
 *
 * @example Canceling an interval
 * ```typescript
 * const intervalId = setInterval(() => console.log('tick'), 1000)
 * // Stop after some condition
 * clearInterval(intervalId)
 * ```
 */
export const clearInterval = (id: ReturnType<typeof globalThis.setInterval> | undefined): void => {
  _clearInterval(id)
}

/**
 * (Safe copy) Queues a microtask to be executed before control returns to the event loop.
 *
 * @param callback - Function to execute.
 *
 * @example Queuing a microtask
 * ```typescript
 * console.log('Start')
 * queueMicrotask(() => console.log('Microtask'))
 * console.log('End')
 * // Output: Start, End, Microtask
 * ```
 */
export const queueMicrotask = (callback: VoidFunction): void => {
  _queueMicrotask(callback)
}

/**
 * (Safe copy) Requests the browser to call a function before the next repaint.
 * Available only in browser environments.
 *
 * @param callback - Function to call before repaint.
 * @returns A request ID or undefined if not available.
 */
export const requestAnimationFrame = _requestAnimationFrame
  ? (callback: FrameRequestCallback): number => _requestAnimationFrame(callback)
  : undefined

/**
 * (Safe copy) Cancels an animation frame request previously scheduled.
 * Available only in browser environments.
 *
 * @param handle - The ID value returned by requestAnimationFrame.
 */
export const cancelAnimationFrame = _cancelAnimationFrame
  ? (handle: number): void => {
      _cancelAnimationFrame(handle)
    }
  : undefined

/**
 * (Safe copy) Namespace object containing all Timer/Scheduling functions.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const Timers = _freeze({
  setTimeout,
  setInterval,
  clearTimeout,
  clearInterval,
  queueMicrotask,
  requestAnimationFrame,
  cancelAnimationFrame,
} as const)
