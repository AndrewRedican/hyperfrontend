import type { SecurityPolicy } from '../types'

/**
 * Applies a security policy to a connection request
 *
 * @param policy - The security policy function
 * @param event - The MessageEvent to validate
 * @returns true if policy allows connection, false otherwise
 */
export function applyPolicy(policy: SecurityPolicy, event: MessageEvent): boolean {
  try {
    const result = policy(event)
    return Boolean(result)
  } catch (error) {
    // Fail-safe: deny on error
    if (process.env['NODE_ENV'] !== 'production') {
      console.error('Security policy threw an error:', error)
    }
    return false
  }
}
