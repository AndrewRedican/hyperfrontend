import type { Router } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidRoutingOptions } from './is-valid-routing-options'

/**
 * Validates whether the provided value is a valid router function.
 * A router must be a function that returns valid routing options.
 *
 * @param router - The value to validate as a router
 * @returns True if the value is a valid router function, false otherwise
 *
 * @example Validating a router function
 * ```typescript
 * const routerFn = () => ({ isDynamic: false, subscriptions: new WeakMap() })
 * isValidRouter(routerFn)
 * // => true
 *
 * isValidRouter('not-a-function')
 * // => false
 * ```
 */
export function isValidRouter(router: unknown) {
  const rt = router as Router
  return getType(rt) === 'function' && isValidRoutingOptions(rt([], []))
}
