/**
 * Safe copies of Function built-in and utilities.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/function
 */

// Capture references at module initialization time
const _Function = globalThis.Function
const _FunctionPrototype = _Function.prototype
const _Reflect = globalThis.Reflect
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Creates a new Function using the captured Function constructor.
 * Use this instead of `new Function()`.
 *
 * NOTE: Dynamic code generation via Function constructor should be avoided when possible
 * due to security risks similar to eval().
 *
 * @param args - Function body and parameter strings.
 * @returns A new Function.
 */
export const createFunction = (...args: string[]): ((...args: unknown[]) => unknown) =>
  <(...args: unknown[]) => unknown>_Reflect.construct(_Function, args)

/**
 * (Safe copy) Reference to the captured Function.prototype.
 */
export const functionPrototype = _FunctionPrototype

/**
 * (Safe copy) Reference to the captured Function.prototype.call.
 */
export const functionCall = _FunctionPrototype.call

/**
 * (Safe copy) Reference to the captured Function.prototype.apply.
 */
export const functionApply = _FunctionPrototype.apply

/**
 * (Safe copy) Reference to the captured Function.prototype.bind.
 */
export const functionBind = _FunctionPrototype.bind

/**
 * (Safe copy) Namespace object containing Function utilities.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const Function = _freeze(<const>{
  create: createFunction,
  prototype: functionPrototype,
  call: functionCall,
  apply: functionApply,
  bind: functionBind,
})
