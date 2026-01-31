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

  it('returns empty string for non-object input', () => {
    expect(cssRules(<Record<string, string>>(<unknown>null))).toEqual('')
    expect(cssRules(<Record<string, string>>(<unknown>undefined))).toEqual('')
    expect(cssRules(<Record<string, string>>(<unknown>'string'))).toEqual('')
    expect(cssRules(<Record<string, string>>(<unknown>123))).toEqual('')
  })
})
