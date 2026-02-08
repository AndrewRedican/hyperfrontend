import type { StyleMap } from '../style'
import { getType } from '@hyperfrontend/data-utils'
import { cssRule } from './css-rule'

/**
 * Creates CSS rules from a styles object, converting each selector-style pair into CSS rule strings.
 *
 * @param styles - An object mapping CSS selectors to style objects
 * @returns A string containing all CSS rules separated by newlines
 */
export function cssRules(styles: StyleMap): string {
  if (getType(styles) !== 'object') return ''
  return Object.entries(styles)
    .map(([selector, style]) => cssRule(selector, style))
    .join('\n')
}
