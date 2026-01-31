import type { RoutingOptions } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidSubscriptions } from './is-valid-subscriptions'

/**
 * Validates whether the provided value is a valid routing options configuration.
 * Routing options must have isDynamic and subscriptions properties.
 *
 * @param options - The value to validate as routing options
 * @returns True if the value is a valid routing options object, false otherwise
 */
export function isValidRoutingOptions(options: unknown): boolean {
  const op = options as RoutingOptions
  return (
    !!op &&
    getType(op) === 'object' &&
    'isDynamic' in op &&
    'subscriptions' in op &&
    getType(op.isDynamic) === 'boolean' &&
    isValidSubscriptions(op.subscriptions)
  )
}
