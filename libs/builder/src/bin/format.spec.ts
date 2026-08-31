import { describe, expect, it } from '@hyperfrontend/testing'
import { normalizeFormats } from './format'

describe('normalizeFormats', () => {
  it('wraps a scalar format in a singleton list', () => {
    expect(normalizeFormats('cjs')).toEqual(['cjs'])
  })

  it('passes an explicit list through unchanged', () => {
    expect(normalizeFormats(['cjs', 'esm'])).toEqual(['cjs', 'esm'])
  })
})
