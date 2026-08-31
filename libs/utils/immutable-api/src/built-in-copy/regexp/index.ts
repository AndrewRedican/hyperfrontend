/**
 * Safe RegExp factory for protected regex construction.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/regexp
 */
/* eslint-disable workspace/lib-require-jsdoc-example */

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
export const createRegExp = (pattern: string | RegExp, flags?: string): RegExp => _Reflect.construct(_RegExp, [pattern, flags]) as RegExp

/**
 * (Safe copy) Namespace object containing RegExp factory.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const RegExp = _freeze({
  create: createRegExp,
} as const)
