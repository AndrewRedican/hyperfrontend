/**
 * Safe copies of String built-in static methods.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/string
 */

// Capture references at module initialization time
const _String = globalThis.String
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Returns a string created from the specified sequence of UTF-16 code units.
 */
export const fromCharCode = _String.fromCharCode

/**
 * (Safe copy) Returns a string created from the specified sequence of Unicode code points.
 */
export const fromCodePoint = _String.fromCodePoint

/**
 * (Safe copy) Returns a string created from a raw template string.
 */
export const raw = _String.raw

/**
 * (Safe copy) Namespace object containing all String static methods.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const String = _freeze(<const>{
  fromCharCode,
  fromCodePoint,
  raw,
})
