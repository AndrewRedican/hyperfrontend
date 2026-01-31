import { getType } from '@hyperfrontend/data-utils'

/**
 * Validates whether the provided value is a valid schema sequence number.
 * The sequence must be a positive number greater than zero.
 *
 * @param sequence - The value to validate as a sequence number
 * @returns True if the value is a positive number, false otherwise
 */
export function isValidSequence(sequence: unknown): boolean {
  return !!(sequence && getType(sequence) === 'number' && <number>sequence > 0)
}
