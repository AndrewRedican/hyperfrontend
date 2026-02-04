import type { SecurityPolicy } from '../types'

/**
 * Validates that a security policy is a function
 *
 * @param policy - The policy to validate
 * @throws {Error} If policy is not a function
 */
export function validatePolicy(policy: unknown): asserts policy is SecurityPolicy {
  if (typeof policy !== 'function') {
    throw new Error('Security policy must be a function that returns true or false.')
  }
}
