/**
 * Safe copies of Math built-in methods.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/math
 */

// Capture references at module initialization time
const _Math = globalThis.Math
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) The mathematical constant e, approximately 2.718.
 */
export const E = _Math.E

/**
 * (Safe copy) The natural logarithm of 2, approximately 0.693.
 */
export const LN2 = _Math.LN2

/**
 * (Safe copy) The natural logarithm of 10, approximately 2.303.
 */
export const LN10 = _Math.LN10

/**
 * (Safe copy) The base-2 logarithm of e, approximately 1.443.
 */
export const LOG2E = _Math.LOG2E

/**
 * (Safe copy) The base-10 logarithm of e, approximately 0.434.
 */
export const LOG10E = _Math.LOG10E

/**
 * (Safe copy) The mathematical constant π, approximately 3.14159.
 */
export const PI = _Math.PI

/**
 * (Safe copy) The square root of 1/2, approximately 0.707.
 */
export const SQRT1_2 = _Math.SQRT1_2

/**
 * (Safe copy) The square root of 2, approximately 1.414.
 */
export const SQRT2 = _Math.SQRT2

/**
 * (Safe copy) Returns the absolute value of a number.
 */
export const abs = _Math.abs

/**
 * (Safe copy) Returns the sign of a number (-1, 0, or 1).
 */
export const sign = _Math.sign

/**
 * (Safe copy) Returns the smallest integer greater than or equal to a number.
 */
export const ceil = _Math.ceil

/**
 * (Safe copy) Returns the largest integer less than or equal to a number.
 */
export const floor = _Math.floor

/**
 * (Safe copy) Returns the value of a number rounded to the nearest integer.
 */
export const round = _Math.round

/**
 * (Safe copy) Returns the integer part of a number by removing fractional digits.
 */
export const trunc = _Math.trunc

/**
 * (Safe copy) Returns the larger of zero or more numbers.
 */
export const max = _Math.max

/**
 * (Safe copy) Returns the smaller of zero or more numbers.
 */
export const min = _Math.min

/**
 * (Safe copy) Returns the base to the exponent power.
 */
export const pow = _Math.pow

/**
 * (Safe copy) Returns the square root of a number.
 */
export const sqrt = _Math.sqrt

/**
 * (Safe copy) Returns the cube root of a number.
 */
export const cbrt = _Math.cbrt

/**
 * (Safe copy) Returns the square root of the sum of squares of its arguments.
 */
export const hypot = _Math.hypot

/**
 * (Safe copy) Returns e raised to the power of a number.
 */
export const exp = _Math.exp

/**
 * (Safe copy) Returns e raised to the power of a number minus 1.
 */
export const expm1 = _Math.expm1

/**
 * (Safe copy) Returns the natural logarithm of a number.
 */
export const log = _Math.log

/**
 * (Safe copy) Returns the base-2 logarithm of a number.
 */
export const log2 = _Math.log2

/**
 * (Safe copy) Returns the base-10 logarithm of a number.
 */
export const log10 = _Math.log10

/**
 * (Safe copy) Returns the natural logarithm of 1 + a number.
 */
export const log1p = _Math.log1p

/**
 * (Safe copy) Returns the sine of a number.
 */
export const sin = _Math.sin

/**
 * (Safe copy) Returns the cosine of a number.
 */
export const cos = _Math.cos

/**
 * (Safe copy) Returns the tangent of a number.
 */
export const tan = _Math.tan

/**
 * (Safe copy) Returns the arcsine of a number.
 */
export const asin = _Math.asin

/**
 * (Safe copy) Returns the arccosine of a number.
 */
export const acos = _Math.acos

/**
 * (Safe copy) Returns the arctangent of a number.
 */
export const atan = _Math.atan

/**
 * (Safe copy) Returns the arctangent of the quotient of its arguments.
 */
export const atan2 = _Math.atan2

/**
 * (Safe copy) Returns the hyperbolic sine of a number.
 */
export const sinh = _Math.sinh

/**
 * (Safe copy) Returns the hyperbolic cosine of a number.
 */
export const cosh = _Math.cosh

/**
 * (Safe copy) Returns the hyperbolic tangent of a number.
 */
export const tanh = _Math.tanh

/**
 * (Safe copy) Returns the inverse hyperbolic sine of a number.
 */
export const asinh = _Math.asinh

/**
 * (Safe copy) Returns the inverse hyperbolic cosine of a number.
 */
export const acosh = _Math.acosh

/**
 * (Safe copy) Returns the inverse hyperbolic tangent of a number.
 */
export const atanh = _Math.atanh

/**
 * (Safe copy) Returns the result of the C-like 32-bit multiplication.
 */
export const imul = _Math.imul

/**
 * (Safe copy) Returns the nearest 32-bit single precision float representation.
 */
export const fround = _Math.fround

/**
 * (Safe copy) Returns the number of leading zero bits in the 32-bit binary representation.
 */
export const clz32 = _Math.clz32

/**
 * (Safe copy) Returns a pseudo-random number between 0 and 1.
 * Note: This is NOT cryptographically secure. For secure random values,
 * use crypto.getRandomValues().
 */
export const random = _Math.random

/**
 * (Safe copy) Namespace object containing all Math utilities.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const Math = _freeze(<const>{
  // Constants
  E,
  LN2,
  LN10,
  LOG2E,
  LOG10E,
  PI,
  SQRT1_2,
  SQRT2,
  // Basic operations
  abs,
  sign,
  ceil,
  floor,
  round,
  trunc,
  // Min/Max
  max,
  min,
  // Powers and roots
  pow,
  sqrt,
  cbrt,
  hypot,
  exp,
  expm1,
  // Logarithms
  log,
  log2,
  log10,
  log1p,
  // Trigonometry
  sin,
  cos,
  tan,
  asin,
  acos,
  atan,
  atan2,
  sinh,
  cosh,
  tanh,
  asinh,
  acosh,
  atanh,
  // Bitwise/Integer
  imul,
  fround,
  clz32,
  // Random
  random,
})
