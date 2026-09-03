/**
 * Safe copies of Number built-in methods and constants.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/number
 */

const _Number = globalThis.Number
const _parseInt = globalThis.parseInt
const _parseFloat = globalThis.parseFloat
const _isNaN = globalThis.isNaN
const _isFinite = globalThis.isFinite
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) The largest positive representable number.
 */
export const MAX_VALUE = _Number.MAX_VALUE

/**
 * (Safe copy) The smallest positive representable number.
 */
export const MIN_VALUE = _Number.MIN_VALUE

/**
 * (Safe copy) The largest safe integer (2^53 - 1).
 */
export const MAX_SAFE_INTEGER = _Number.MAX_SAFE_INTEGER

/**
 * (Safe copy) The smallest safe integer (-(2^53 - 1)).
 */
export const MIN_SAFE_INTEGER = _Number.MIN_SAFE_INTEGER

/**
 * (Safe copy) Positive infinity.
 */
export const POSITIVE_INFINITY = _Number.POSITIVE_INFINITY

/**
 * (Safe copy) Negative infinity.
 */
export const NEGATIVE_INFINITY = _Number.NEGATIVE_INFINITY

/**
 * (Safe copy) The difference between 1 and the smallest floating point number greater than 1.
 */
export const EPSILON = _Number.EPSILON

/**
 * (Safe copy) Not-a-Number value.
 */
export const NUMBER_NaN = _Number.NaN

/**
 * (Safe copy) Determines whether the passed value is NaN (Number method, stricter than global isNaN).
 */
export const isNaN = _Number.isNaN

/**
 * (Safe copy) Determines whether the passed value is a finite number.
 */
export const isFinite = _Number.isFinite

/**
 * (Safe copy) Determines whether the passed value is an integer.
 */
export const isInteger = _Number.isInteger

/**
 * (Safe copy) Determines whether the passed value is a safe integer.
 */
export const isSafeInteger = _Number.isSafeInteger

/**
 * (Safe copy) Parses a string and returns an integer.
 */
export const parseInt = _parseInt

/**
 * (Safe copy) Parses a string and returns a floating point number.
 */
export const parseFloat = _parseFloat

/**
 * (Safe copy) Global isNaN function (coerces to number first, less strict than Number.isNaN).
 */
export const globalIsNaN = _isNaN

/**
 * (Safe copy) Global isFinite function (coerces to number first, less strict than Number.isFinite).
 */
export const globalIsFinite = _isFinite

/**
 * (Safe copy) Namespace object containing all Number utilities.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const Number = _freeze({
  MAX_VALUE,
  MIN_VALUE,
  MAX_SAFE_INTEGER,
  MIN_SAFE_INTEGER,
  POSITIVE_INFINITY,
  NEGATIVE_INFINITY,
  EPSILON,
  NUMBER_NaN,
  isNaN,
  isFinite,
  isInteger,
  isSafeInteger,
  parseInt,
  parseFloat,
  globalIsNaN,
  globalIsFinite,
} as const)
