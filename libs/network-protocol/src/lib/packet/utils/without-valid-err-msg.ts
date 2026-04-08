/**
 * Generates a standardized error message for invalid packet configuration.
 * Used to provide consistent error messaging across packet creation failures.
 *
 * @param label - The name of the invalid configuration parameter
 * @returns A formatted error message string
 *
 * @example
 * ```typescript
 * withoutValidErrorMessage('origin')
 * // => 'Cannot create a packet without a valid origin value'
 * ```
 */
export function withoutValidErrorMessage(label: string): string {
  return `Cannot create a packet without a valid ${label} value`
}
