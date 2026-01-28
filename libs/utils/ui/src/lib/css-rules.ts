import type { StyleMap } from '../style'
import { getType } from '@hyperfrontend/data-utils'
import { cssRule } from './css-rule'

export function cssRules(styles: StyleMap): string {
  if (getType(styles) !== 'object') return ''
  return Object.entries(styles)
    .map(([selector, style]) => cssRule(selector, style))
    .join('\n')
}
