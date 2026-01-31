/**
 * Validates whether the provided value is valid unserialized data.
 * Unserialized data must be a Uint8Array instance.
 *
 * @param data - The value to validate as unserialized data
 * @returns True if the value is a Uint8Array, false otherwise
 */
export function isValidUnserializedData(data: unknown): boolean {
  return !!data && data instanceof Uint8Array
}
