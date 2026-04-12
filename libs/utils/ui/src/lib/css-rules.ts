import type { StyleMap } from '../style'
import { getType } from '@hyperfrontend/data-utils'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { cssRule } from './css-rule'

/**
 * Creates CSS rules from a styles object, converting each selector-style pair into CSS rule strings.
 *
 * @param styles - An object mapping CSS selectors to style objects
 * @returns A string containing all CSS rules separated by newlines
 *
 * @example Creating CSS rules from object
 * ```typescript
 * const styles = {
 *   '.card': { padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
 *   '.card-title': { fontSize: '18px', fontWeight: 'bold' }
 * }
 *
 * cssRules(styles)
 * // => '.card{padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1)}\n.card-title{font-size: 18px; font-weight: bold}'
 * ```
 */
export function cssRules(styles: StyleMap): string {
  if (getType(styles) !== 'object') return ''
  return entries(styles)
    .map(([selector, style]) => cssRule(selector, style))
    .join('\n')
}
