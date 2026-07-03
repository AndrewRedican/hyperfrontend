import { createTextDecoder } from '@hyperfrontend/immutable-api-utils/built-in-copy/encoding'

let cachedUtf8Decoder: TextDecoder | undefined

/**
 * Returns the shared UTF-8 TextDecoder, creating it on first use.
 *
 * @returns The memoized UTF-8 TextDecoder instance.
 *
 * @example Decoding bytes with the shared decoder
 * ```typescript
 * const text = getUtf8Decoder().decode(new Uint8Array([104, 105]))
 * // => 'hi'
 * ```
 */
export function getUtf8Decoder(): TextDecoder {
  // why: lazy creation keeps importing this module free of side effects so bundlers can tree-shake it safely
  cachedUtf8Decoder ??= createTextDecoder('utf8')
  return cachedUtf8Decoder
}
