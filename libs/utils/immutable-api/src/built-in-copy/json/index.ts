/**
 * Safe copies of JSON built-in methods.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/json
 */

// Capture references at module initialization time
const _JSON = globalThis.JSON

/**
 * (Safe copy) Converts a JavaScript Object Notation (JSON) string into an object.
 */
export const parse = _JSON.parse

/**
 * (Safe copy) Converts a JavaScript value to a JavaScript Object Notation (JSON) string.
 */
export const stringify = _JSON.stringify

/**
 * (Safe copy) Namespace object containing all JSON methods.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const JSON = <const>{
  parse,
  stringify,
}
