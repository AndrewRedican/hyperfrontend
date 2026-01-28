import type { Router } from '../model'
import { getType } from '@hyperfrontend/data-utils'
import { isValidRoutingOptions } from './is-valid-routing-options'

export function isValidRouter(router: unknown) {
  const rt = router as Router
  return getType(rt) === 'function' && isValidRoutingOptions(rt([], []))
}
