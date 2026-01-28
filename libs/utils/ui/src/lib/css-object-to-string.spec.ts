import type { Style } from '../style'
import { cssObjectToString } from './css-object-to-string'

describe('cssObjectToString', () => {
  it('converts CSS object to valid CSS string', () => {
    const cssObject: Style = {
      backgroundColor: 'red',
      fontSize: '16px',
    }
    const expectedCssString = 'background-color: red; font-size: 16px; '
    const result = cssObjectToString(cssObject)
    expect(result).toEqual(expectedCssString)
  })

  it('handles CSS values explicity passed as empty strings', () => {
    expect(cssObjectToString({ content: '' })).toEqual(`content: ''; `)
  })

  it('logs warning when property conversion fails', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

    const problematicValue = {
      toString() {
        throw new Error('Conversion failed')
      },
    }

    const problematicObject: any = {
      backgroundColor: 'red',
      badProperty: problematicValue,
    }

    const result = cssObjectToString(problematicObject)

    expect(result).toContain('background-color: red;')
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Some properties failed to convert'))
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to convert property "badProperty"'))

    consoleWarnSpy.mockRestore()
  })
})
