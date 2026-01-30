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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(cssRules(null as any)).toEqual('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(cssRules(undefined as any)).toEqual('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(cssRules('string' as any)).toEqual('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(cssRules(123 as any)).toEqual('')
  })
})
