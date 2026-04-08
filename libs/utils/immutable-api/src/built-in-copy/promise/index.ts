/* eslint-disable workspace/lib-require-jsdoc-example */
/**
 * Safe copies of Promise built-in methods via factory functions.
 *
 * Since constructors cannot be safely captured via Object.assign, this module
 * provides factory functions that use Reflect.construct internally.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/promise
 */

const _Promise = globalThis.Promise
const _Reflect = globalThis.Reflect
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Creates a new Promise using the captured Promise constructor.
 * Use this instead of `new Promise()`.
 *
 * @param executor - The executor function.
 * @returns A new Promise instance.
 */
export const createPromise = <T>(
  executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void
): Promise<T> => <Promise<T>>_Reflect.construct(_Promise, [executor])

/**
 * (Safe copy) Returns a Promise that resolves with the given value.
 */
export const promiseResolve = _Promise.resolve.bind(_Promise)

/**
 * (Safe copy) Returns a Promise that rejects with the given reason.
 */
export const promiseReject = _Promise.reject.bind(_Promise)

/**
 * (Safe copy) Returns a Promise that resolves when all promises resolve.
 */
export const promiseAll = _Promise.all.bind(_Promise)

/**
 * (Safe copy) Returns a Promise that resolves/rejects with the first settled promise.
 */
export const promiseRace = _Promise.race.bind(_Promise)

/**
 * (Safe copy) Returns a Promise that resolves when all promises settle.
 */
export const promiseAllSettled = _Promise.allSettled.bind(_Promise)

/**
 * (Safe copy) Returns a Promise that resolves with the first fulfilled promise.
 */
export const promiseAny = _Promise.any.bind(_Promise)

/**
 * (Safe copy) Creates a Promise along with its resolve and reject functions.
 * Note: Available only in ES2024+ environments.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const promiseWithResolvers = (<any>_Promise).withResolvers?.bind(_Promise)

/**
 * (Safe copy) Namespace object containing all Promise factory functions.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const Promise = _freeze(<const>{
  create: createPromise,
  resolve: promiseResolve,
  reject: promiseReject,
  all: promiseAll,
  race: promiseRace,
  allSettled: promiseAllSettled,
  any: promiseAny,
  withResolvers: promiseWithResolvers,
})
