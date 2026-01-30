import type { Style } from '../style'
import { cssRule } from './css-rule'

describe('cssRule', () => {
  it('returns a css rule as string for the corresponding selector and style', () => {
    const cssObject: Style = {
      backgroundColor: 'red',
      fontSize: '16px',
    }
    const result = cssRule('#id', cssObject)
    expect(result).toEqual('#id{background-color: red; font-size: 16px;}')
  })

  it('accepts string css', () => {
    const result = cssRule('.class', 'color: blue; margin: 10px;')
    expect(result).toEqual('.class{color: blue; margin: 10px;}')
  })

  it('throws error for invalid selector', () => {
    expect(() => cssRule('', 'color: red;')).toThrow('A valid css select must be provided')
  })

  it('throws error for empty css string', () => {
    expect(() => cssRule('.class', '')).toThrow('A valid string value must be provided to add in styleesheet.')
  })

  it('throws error for non-string non-object css', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => cssRule('.class', 123 as any)).toThrow('A valid string value must be provided to add in styleesheet.')
  })
})
