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
 */
export function isValidUnserializedData(data: unknown): boolean {
  if (!data) return false

  // Primary check - works in same realm
  if (data instanceof Uint8Array) return true

  // Cross-realm fallback - check if it looks like a Uint8Array
  // This handles cases like jsdom tests where different realms have different Uint8Array constructors
  const proto = typeTag(data)
  return proto === '[object Uint8Array]'
}
