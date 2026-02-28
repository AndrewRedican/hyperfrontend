/**
 * Safe copies of Error built-ins via factory functions.
 *
 * Since constructors cannot be safely captured via Object.assign, this module
 * provides factory functions that use Reflect.construct internally.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/error
 */

// Capture references at module initialization time
const _Error = globalThis.Error
const _TypeError = globalThis.TypeError
const _RangeError = globalThis.RangeError
const _ReferenceError = globalThis.ReferenceError
const _SyntaxError = globalThis.SyntaxError
const _URIError = globalThis.URIError
const _EvalError = globalThis.EvalError
const _AggregateError = globalThis.AggregateError
const _Reflect = globalThis.Reflect

/**
 * (Safe copy) Creates a new Error using the captured Error constructor.
 * Use this instead of `new Error()`.
 *
 * @param message - Optional error message.
 * @param options - Optional error options.
 * @returns A new Error instance.
 */
export const createError = (message?: string, options?: ErrorOptions): Error => <Error>_Reflect.construct(_Error, [message, options])

/**
 * (Safe copy) Creates a new TypeError using the captured TypeError constructor.
 * Use this instead of `new TypeError()`.
 *
 * @param message - Optional error message.
 * @param options - Optional error options.
 * @returns A new TypeError instance.
 */
export const createTypeError = (message?: string, options?: ErrorOptions): TypeError =>
  <TypeError>_Reflect.construct(_TypeError, [message, options])

/**
 * (Safe copy) Creates a new RangeError using the captured RangeError constructor.
 * Use this instead of `new RangeError()`.
 *
 * @param message - Optional error message.
 * @param options - Optional error options.
 * @returns A new RangeError instance.
 */
export const createRangeError = (message?: string, options?: ErrorOptions): RangeError =>
  <RangeError>_Reflect.construct(_RangeError, [message, options])

/**
 * (Safe copy) Creates a new ReferenceError using the captured ReferenceError constructor.
 * Use this instead of `new ReferenceError()`.
 *
 * @param message - Optional error message.
 * @param options - Optional error options.
 * @returns A new ReferenceError instance.
 */
export const createReferenceError = (message?: string, options?: ErrorOptions): ReferenceError =>
  <ReferenceError>_Reflect.construct(_ReferenceError, [message, options])

/**
 * (Safe copy) Creates a new SyntaxError using the captured SyntaxError constructor.
 * Use this instead of `new SyntaxError()`.
 *
 * @param message - Optional error message.
 * @param options - Optional error options.
 * @returns A new SyntaxError instance.
 */
export const createSyntaxError = (message?: string, options?: ErrorOptions): SyntaxError =>
  <SyntaxError>_Reflect.construct(_SyntaxError, [message, options])

/**
 * (Safe copy) Creates a new URIError using the captured URIError constructor.
 * Use this instead of `new URIError()`.
 *
 * @param message - Optional error message.
 * @param options - Optional error options.
 * @returns A new URIError instance.
 */
export const createURIError = (message?: string, options?: ErrorOptions): URIError =>
  <URIError>_Reflect.construct(_URIError, [message, options])

/**
 * (Safe copy) Creates a new EvalError using the captured EvalError constructor.
 * Use this instead of `new EvalError()`.
 *
 * @param message - Optional error message.
 * @param options - Optional error options.
 * @returns A new EvalError instance.
 */
export const createEvalError = (message?: string, options?: ErrorOptions): EvalError =>
  <EvalError>_Reflect.construct(_EvalError, [message, options])

/**
 * (Safe copy) Creates a new AggregateError using the captured AggregateError constructor.
 * Use this instead of `new AggregateError()`.
 *
 * @param errors - An iterable of errors to aggregate.
 * @param message - Optional error message.
 * @param options - Optional error options.
 * @returns A new AggregateError instance.
 */
export const createAggregateError = (errors: Iterable<unknown>, message?: string, options?: ErrorOptions): AggregateError =>
  <AggregateError>_Reflect.construct(_AggregateError, [errors, message, options])

/**
 * (Safe copy) Namespace object containing Error factory functions.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const Error = <const>{
  create: createError,
  TypeError: createTypeError,
  RangeError: createRangeError,
  ReferenceError: createReferenceError,
  SyntaxError: createSyntaxError,
  URIError: createURIError,
  EvalError: createEvalError,
  AggregateError: createAggregateError,
}
