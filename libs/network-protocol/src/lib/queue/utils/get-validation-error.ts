import type { QueueCreatorValidity } from '../model'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Generates a descriptive error message for queue validation failures.
 * Maps validation field names to human-readable error descriptions.
 *
 * @param operationType - The type of operation being validated (e.g., 'send', 'receive')
 * @param validity - The validation results indicating which fields are invalid
 * @returns A formatted error message describing the validation failure
 *
 * @example
 * ```typescript
 * const validity = { label: true, operation: false, logger: true, onSuccess: true, onFail: true }
 * getValidationError('encryption', validity)
 * // => 'Cannot create encryption queue without encryption function'
 * ```
 */
export function getValidationError(operationType: string, validity: QueueCreatorValidity): string {
  const errorMap: Record<string, string> = {
    label: 'a label',
    operation: `${operationType} function`,
    logger: 'a logger',
    onSuccess: 'a success callback function',
    onFail: 'a failed callback function',
  }
  const invalidEntry = entries(validity).find(([, value]) => value === false)
  if (!invalidEntry) return ''
  const [key] = invalidEntry
  return `Cannot create ${operationType} queue without ${errorMap[key]}`
}
