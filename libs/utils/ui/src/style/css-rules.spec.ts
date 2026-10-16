import { describe, expect, it } from '@hyperfrontend/testing'
import { cssRules } from './css-rules'

describe('cssRules', () => {
  it('returns an empty string for an empty StyleMap', () => {
    const result = cssRules({})
    expect(result).toEqual('')
  })

  it('generates CSS rules for a non-empty StyleMap', () => {
    const result = cssRules({
      '.selector1': 'color: red;',
      '.selector2': 'font-size: 16px;',
      '.selector3': { backgroundColor: 'green' },
    })
    expect(result).toEqual('.selector1{color: red;}\n.selector2{font-size: 16px;}\n.selector3{background-color: green;}')
  })

  it.each([null, undefined, 'string', 123])('returns empty string for the non-object input %p', (styles: unknown) => {
    expect(cssRules(styles as Record<string, string>)).toEqual('')
  })
})
