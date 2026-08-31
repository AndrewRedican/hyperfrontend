import type { Logger } from '@hyperfrontend/logging'
import type { SecurityPolicy } from '../types'

/**
 * Applies a security policy to a connection request.
 *
 * @param policy - The security policy function
 * @param event - The MessageEvent to validate
 * @param logger - Logger instance for error reporting
 * @returns true if policy allows connection, false otherwise
 *
 * @example Validating connection requests with security policy
 * ```typescript
 * const policy = (event) => event.origin === 'https://trusted.example.com'
 * const allowed = applyPolicy(policy, messageEvent, logger)
 * // => true or false
 * ```
 */
export function applyPolicy(policy: SecurityPolicy, event: MessageEvent, logger: Logger): boolean {
  try {
    const result = policy(event)
    return Boolean(result)
  } catch (error) {
    logger.error('Security policy threw an error:', error as Error)
    return false
  }
}
