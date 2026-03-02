/**
 * Safe copies of URL built-ins via factory functions.
 *
 * Provides safe references to URL and URLSearchParams.
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/url
 */

// Capture references at module initialization time
const _URL = globalThis.URL
const _URLSearchParams = globalThis.URLSearchParams
const _Reflect = globalThis.Reflect
const _freeze = globalThis.Object.freeze

// ============================================================================
// URL
// ============================================================================

/**
 * (Safe copy) Creates a new URL using the captured URL constructor.
 * Use this instead of `new URL()`.
 *
 * @param url - The URL string to parse.
 * @param base - Optional base URL for relative URLs.
 * @returns A new URL instance.
 */
export const createURL = (url: string | URL, base?: string | URL): URL => <URL>_Reflect.construct(_URL, [url, base])

/**
 * (Safe copy) Returns whether the provided string is a valid URL.
 * Use this instead of `URL.canParse()`.
 *
 * @param url - The URL string to validate.
 * @param base - Optional base URL for relative URLs.
 * @returns True if the URL is valid, false otherwise.
 */
export const canParse = _URL.canParse

/**
 * (Safe copy) Creates an object URL for the given object.
 * Use this instead of `URL.createObjectURL()`.
 *
 * Note: This is a browser-only API. In Node.js environments, this will throw.
 */
export const createObjectURL: (typeof globalThis.URL)['createObjectURL'] =
  typeof _URL.createObjectURL === 'function'
    ? _URL.createObjectURL.bind(_URL)
    : () => {
        throw new Error('URL.createObjectURL is not available in this environment')
      }

/**
 * (Safe copy) Revokes an object URL previously created with createObjectURL.
 * Use this instead of `URL.revokeObjectURL()`.
 *
 * Note: This is a browser-only API. In Node.js environments, this will throw.
 */
export const revokeObjectURL: (typeof globalThis.URL)['revokeObjectURL'] =
  typeof _URL.revokeObjectURL === 'function'
    ? _URL.revokeObjectURL.bind(_URL)
    : () => {
        throw new Error('URL.revokeObjectURL is not available in this environment')
      }

/**
 * (Safe copy) Parses a URL string and returns a URL object, or null if invalid.
 * Use this instead of `URL.parse()`.
 *
 * @param url - The URL string to parse.
 * @param base - Optional base URL for relative URLs.
 * @returns A URL instance or null if parsing fails.
 */
export const parseURL = _URL.parse

// ============================================================================
// URLSearchParams
// ============================================================================

/**
 * (Safe copy) Creates a new URLSearchParams using the captured URLSearchParams constructor.
 * Use this instead of `new URLSearchParams()`.
 *
 * @param init - Optional initialization value (string, object, or iterable).
 * @returns A new URLSearchParams instance.
 */
export const createURLSearchParams = (
  init?: string | URLSearchParams | Record<string, string> | Iterable<[string, string]>
): URLSearchParams => <URLSearchParams>_Reflect.construct(_URLSearchParams, [init])

// ============================================================================
// Namespace Export
// ============================================================================

/**
 * (Safe copy) Namespace object containing all URL utilities.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const URL = _freeze(<const>{
  createURL,
  canParse,
  createObjectURL,
  revokeObjectURL,
  parseURL,
  createURLSearchParams,
})
