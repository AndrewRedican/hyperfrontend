/**
 * Platform detection utility.
 *
 * Provides runtime detection of the execution environment (browser or Node.js)
 * for use in lazy loading protocol providers with the correct platform variant.
 *
 * @module security/platform
 */

/**
 * Platform type identifier.
 */
export type Platform = 'browser' | 'node'

/**
 * Detects the current runtime platform.
 *
 * Uses standard heuristics to determine if the code is running in a
 * browser environment or Node.js:
 * - Browser: `window` object is defined
 * - Node.js: `process.versions.node` is defined
 *
 * This is used by protocol loaders to import the correct platform-specific
 * protocol implementation from network-protocol.
 *
 * @returns `'browser'` if running in a browser, `'node'` if running in Node.js
 *
 * @example Detecting runtime platform
 * ```typescript
 * const platform = detectPlatform()
 *
 * // Load platform-specific protocol
 * const module = await import(`@hyperfrontend/network-protocol/${platform}/v2`)
 * const provider = module.createProtocol(logger, sharedKey, 60)
 * ```
 */
export function detectPlatform(): Platform {
  if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    return 'browser'
  }

  if (
    typeof process !== 'undefined' &&
    process.versions !== null &&
    process.versions !== undefined &&
    typeof process.versions.node !== 'undefined'
  ) {
    return 'node'
  }

  /* istanbul ignore next -- fallback for unknown environments */
  return 'browser'
}
