import type { Logger } from '@hyperfrontend/logging'
import type { SecurityPolicy } from '../types'

/**
 * Applies a security policy to a connection request.
 *
 * @param policy - The security policy function
 * @param event - The MessageEvent to validate
 * @param logger - Logger instance for error reporting
 * @returns true if policy allows connection, false otherwise
 */
export function applyPolicy(policy: SecurityPolicy, event: MessageEvent, logger: Logger): boolean {
  try {
    const result = policy(event)
    return Boolean(result)
  } catch (error) {
    // Fail-safe: deny on error
    logger.error('Security policy threw an error:', <Error>error)
    return false
  }
}
