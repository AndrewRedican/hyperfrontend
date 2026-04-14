/**
 * Safe copies of encoding built-ins for TextEncoder, TextDecoder, atob, and btoa.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/encoding
 */
/* eslint-disable workspace/lib-require-jsdoc-example */

const _TextEncoder = globalThis.TextEncoder
const _TextDecoder = globalThis.TextDecoder
const _atob = globalThis.atob
const _btoa = globalThis.btoa
const _Reflect = globalThis.Reflect
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Creates a new TextEncoder using the captured TextEncoder constructor.
 * Use this instead of `new TextEncoder()`.
 *
 * @returns A new TextEncoder instance.
 */
export const createTextEncoder = (): TextEncoder => <TextEncoder>_Reflect.construct(_TextEncoder, [])

/**
 * (Safe copy) Creates a new TextDecoder using the captured TextDecoder constructor.
 * Use this instead of `new TextDecoder()`.
 *
 * @param label - The encoding label (e.g., 'utf-8', 'utf-16'). Defaults to 'utf-8'.
 * @param options - Optional TextDecoderOptions.
 * @returns A new TextDecoder instance.
 */
export const createTextDecoder = (label?: string, options?: TextDecoderOptions): TextDecoder =>
  <TextDecoder>_Reflect.construct(_TextDecoder, [label, options])

/**
 * (Safe copy) Decodes a base64-encoded string.
 * Use this instead of `atob()`.
 *
 * @param data - The base64-encoded string to decode.
 * @returns The decoded string.
 */
export const atob = (data: string): string => _atob(data)

/**
 * (Safe copy) Encodes a string to base64.
 * Use this instead of `btoa()`.
 *
 * @param data - The string to encode.
 * @returns The base64-encoded string.
 */
export const btoa = (data: string): string => _btoa(data)

/**
 * (Safe copy) Namespace object containing all encoding utilities.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const Encoding = _freeze(<const>{
  createTextEncoder,
  createTextDecoder,
  atob,
  btoa,
})
