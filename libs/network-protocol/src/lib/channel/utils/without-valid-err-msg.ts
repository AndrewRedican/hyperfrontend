/**
 * Generates a standardized error message for invalid channel configuration.
 * Used to provide consistent error messaging across channel creation failures.
 *
 * @param label - The name of the invalid configuration parameter
 * @returns A formatted error message string
 */
export function withoutValidErrorMessage(label: string): string {
  return `Cannot create a channel without a valid ${label}`
}
