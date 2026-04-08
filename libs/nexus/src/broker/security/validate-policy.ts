import type { SecurityPolicy } from '../types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Validates that a security policy is a function
 *
 * @param policy - The policy to validate
 * @throws {Error} If policy is not a function
 *
 * @example
 * ```typescript
 * validatePolicy((event) => event.origin === 'https://trusted.com')
 * // No error thrown
 *
 * validatePolicy('not-a-function')
 * // Throws: Security policy must be a function...
 * ```
 */
export function validatePolicy(policy: unknown): asserts policy is SecurityPolicy {
  if (typeof policy !== 'function') {
    throw createError('Security policy must be a function that returns true or false.')
  }
}
