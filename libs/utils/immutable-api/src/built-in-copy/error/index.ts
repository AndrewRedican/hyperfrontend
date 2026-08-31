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

const _Error = globalThis.Error
const _TypeError = globalThis.TypeError
const _RangeError = globalThis.RangeError
const _ReferenceError = globalThis.ReferenceError
const _SyntaxError = globalThis.SyntaxError
const _URIError = globalThis.URIError
const _EvalError = globalThis.EvalError
const _AggregateError = globalThis.AggregateError
const _Reflect = globalThis.Reflect
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Creates a new Error using the captured Error constructor.
 * Use this instead of `new Error()`.
 *
 * @param message - Optional error message.
 * @param options - Optional error options.
 * @returns A new Error instance.
 *
 * @example Creating Error instances
 * ```typescript
 * const error = createError('Operation failed')
 * // With cause for error chaining
 * const wrapped = createError('Request failed', { cause: originalError })
 * ```
 */
export const createError = (message?: string, options?: ErrorOptions): Error => _Reflect.construct(_Error, [message, options]) as Error

/**
 * (Safe copy) Creates a new TypeError using the captured TypeError constructor.
 * Use this instead of `new TypeError()`.
 *
 * @param message - Optional error message.
 * @param options - Optional error options.
 * @returns A new TypeError instance.
 *
 * @example Creating TypeError instance
 * ```typescript
 * if (typeof value !== 'string') {
 *   throw createTypeError('Expected a string')
 * }
 * ```
 */
export const createTypeError = (message?: string, options?: ErrorOptions): TypeError =>
  _Reflect.construct(_TypeError, [message, options]) as TypeError

/**
 * (Safe copy) Creates a new RangeError using the captured RangeError constructor.
 * Use this instead of `new RangeError()`.
 *
 * @param message - Optional error message.
 * @param options - Optional error options.
 * @returns A new RangeError instance.
 *
 * @example Creating RangeError instance
 * ```typescript
 * if (index < 0 || index >= array.length) {
 *   throw createRangeError(`Index ${index} out of bounds`)
 * }
 * ```
 */
export const createRangeError = (message?: string, options?: ErrorOptions): RangeError =>
  _Reflect.construct(_RangeError, [message, options]) as RangeError

/**
 * (Safe copy) Creates a new ReferenceError using the captured ReferenceError constructor.
 * Use this instead of `new ReferenceError()`.
 *
 * @param message - Optional error message.
 * @param options - Optional error options.
 * @returns A new ReferenceError instance.
 *
 * @example Creating ReferenceError instance
 * ```typescript
 * if (!(key in registry)) {
 *   throw createReferenceError(`Unknown key: ${key}`)
 * }
 * ```
 */
export const createReferenceError = (message?: string, options?: ErrorOptions): ReferenceError =>
  _Reflect.construct(_ReferenceError, [message, options]) as ReferenceError

/**
 * (Safe copy) Creates a new SyntaxError using the captured SyntaxError constructor.
 * Use this instead of `new SyntaxError()`.
 *
 * @param message - Optional error message.
 * @param options - Optional error options.
 * @returns A new SyntaxError instance.
 *
 * @example Creating SyntaxError instance
 * ```typescript
 * if (!isValidJson(input)) {
 *   throw createSyntaxError('Invalid JSON format')
 * }
 * ```
 */
export const createSyntaxError = (message?: string, options?: ErrorOptions): SyntaxError =>
  _Reflect.construct(_SyntaxError, [message, options]) as SyntaxError

/**
 * (Safe copy) Creates a new URIError using the captured URIError constructor.
 * Use this instead of `new URIError()`.
 *
 * @param message - Optional error message.
 * @param options - Optional error options.
 * @returns A new URIError instance.
 *
 * @example Creating URIError instance
 * ```typescript
 * if (!isValidUtf8(encoded)) {
 *   throw createURIError('Malformed URI sequence')
 * }
 * ```
 */
export const createURIError = (message?: string, options?: ErrorOptions): URIError =>
  _Reflect.construct(_URIError, [message, options]) as URIError

/**
 * (Safe copy) Creates a new EvalError using the captured EvalError constructor.
 * Use this instead of `new EvalError()`.
 *
 * @param message - Optional error message.
 * @param options - Optional error options.
 * @returns A new EvalError instance.
 *
 * @example Creating EvalError instance
 * ```typescript
 * throw createEvalError('Dynamic code execution is not allowed')
 * ```
 */
export const createEvalError = (message?: string, options?: ErrorOptions): EvalError =>
  _Reflect.construct(_EvalError, [message, options]) as EvalError

/**
 * (Safe copy) Creates a new AggregateError using the captured AggregateError constructor.
 * Use this instead of `new AggregateError()`.
 *
 * @param errors - An iterable of errors to aggregate.
 * @param message - Optional error message.
 * @param options - Optional error options.
 * @returns A new AggregateError instance.
 *
 * @example Creating AggregateError instance
 * ```typescript
 * const results = await Promise.allSettled(promises)
 * const failures = results.filter(r => r.status === 'rejected').map(r => r.reason)
 * if (failures.length > 0) {
 *   throw createAggregateError(failures, 'Multiple operations failed')
 * }
 * ```
 */
export const createAggregateError = (errors: Iterable<unknown>, message?: string, options?: ErrorOptions): AggregateError =>
  _Reflect.construct(_AggregateError, [errors, message, options]) as AggregateError

/**
 * (Safe copy) Namespace object containing Error factory functions.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const Error = _freeze({
  create: createError,
  TypeError: createTypeError,
  RangeError: createRangeError,
  ReferenceError: createReferenceError,
  SyntaxError: createSyntaxError,
  URIError: createURIError,
  EvalError: createEvalError,
  AggregateError: createAggregateError,
} as const)
