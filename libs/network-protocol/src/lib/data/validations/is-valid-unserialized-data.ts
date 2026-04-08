import { typeTag } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Validates whether the provided value is valid unserialized data.
 * Unserialized data must be a Uint8Array instance.
 *
 * Note: Uses multiple checks to handle cross-realm scenarios (e.g., jsdom in tests)
 * where `instanceof Uint8Array` may fail due to different global contexts.
 *
 * @param data - The value to validate as unserialized data
 * @returns True if the value is a Uint8Array, false otherwise
 *
 * @example
 * ```typescript
 * isValidUnserializedData(new Uint8Array([1, 2, 3]))
 * // => true
 *
 * isValidUnserializedData('string-data')
 * // => false
 * ```
 */
export function isValidUnserializedData(data: unknown): boolean {
  if (!data) return false

  if (data instanceof Uint8Array) return true

  const proto = typeTag(data)
  return proto === '[object Uint8Array]'
}
