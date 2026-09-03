import type { Style } from '../style'
import { logger } from '@hyperfrontend/logging'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
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
    const loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => void 0)

    const problematicValue = {
      toString() {
        throw new Error('Conversion failed')
      },
    }

    const problematicObject: Record<string, unknown> = {
      backgroundColor: 'red',
      badProperty: problematicValue,
    }

    const result = cssObjectToString(problematicObject as Partial<CSSStyleDeclaration>)

    expect(result).toContain('background-color: red;')
    expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Some properties failed to convert'))
    expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to convert property "badProperty"'))

    loggerWarnSpy.mockRestore()
  })
})
