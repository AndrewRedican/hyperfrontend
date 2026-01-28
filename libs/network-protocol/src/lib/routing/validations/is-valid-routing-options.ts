import type { RoutingOptions } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidSubscriptions } from './is-valid-subscriptions'

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
