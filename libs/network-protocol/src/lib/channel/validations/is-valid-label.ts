import { getType } from '@hyperfrontend/data-utils'

/**
 * Validates whether a label meets the required criteria of being a non-empty string.
 *
 * @param label - The label string to validate
 * @returns True if the label is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidLabel('channel-1') // => true
 * isValidLabel('') // => false
 * ```
 */
export function isValidLabel(label: string) {
  return getType(label) === 'string' && label.length > 0
}
