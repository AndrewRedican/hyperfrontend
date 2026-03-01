/**
 * Safe copies of Date built-in via factory function and static methods.
 *
 * Since constructors cannot be safely captured via Object.assign, this module
 * provides a factory function that uses Reflect.construct internally.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/date
 */

// Capture references at module initialization time
const _Date = globalThis.Date
const _Reflect = globalThis.Reflect
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Creates a new Date using the captured Date constructor.
 * Use this instead of `new Date()`. Accepts all standard Date constructor signatures.
 *
 * @returns A new Date instance.
 */
export function createDate(): Date
export function createDate(value: number | string | Date): Date
export function createDate(
  year: number,
  monthIndex: number,
  date?: number,
  hours?: number,
  minutes?: number,
  seconds?: number,
  ms?: number
): Date
export function createDate(...args: unknown[]): Date {
  return <Date>_Reflect.construct(_Date, args)
}

/**
 * (Safe copy) Returns the number of milliseconds elapsed since January 1, 1970 00:00:00 UTC.
 */
export const dateNow = _Date.now

/**
 * (Safe copy) Parses a string representation of a date.
 */
export const dateParse = _Date.parse

/**
 * (Safe copy) Returns the number of milliseconds in a Date object since January 1, 1970 UTC.
 */
export const dateUTC = _Date.UTC

/**
 * (Safe copy) Namespace object containing Date factory and static methods.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const Date = _freeze(<const>{
  create: createDate,
  now: dateNow,
  parse: dateParse,
  UTC: dateUTC,
})
