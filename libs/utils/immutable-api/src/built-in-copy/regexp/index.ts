/**
 * Safe copies of RegExp built-in via factory function.
 *
 * Since constructors cannot be safely captured via Object.assign, this module
 * provides a factory function that uses Reflect.construct internally.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/regexp
 */

// Capture references at module initialization time
const _RegExp = globalThis.RegExp
const _Reflect = globalThis.Reflect
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Creates a new RegExp using the captured RegExp constructor.
 * Use this instead of `new RegExp()`.
 *
 * @param pattern - The pattern string or RegExp to copy.
 * @param flags - Optional flags string.
 * @returns A new RegExp instance.
 */
export const createRegExp = (pattern: string | RegExp, flags?: string): RegExp => <RegExp>_Reflect.construct(_RegExp, [pattern, flags])

/**
 * (Safe copy) Namespace object containing RegExp factory.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const RegExp = _freeze(<const>{
  create: createRegExp,
})
