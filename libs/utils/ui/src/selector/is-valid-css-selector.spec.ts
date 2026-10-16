import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidCssSelector } from './is-valid-css-selector'

describe('isValidCssSelector', () => {
  it.each(['#id', "[id='value']"])('returns true for the valid css selector %p', (selector: string) => {
    expect(isValidCssSelector(selector)).toBe(true)
  })

  it.each(['', '"', ',', ':', ' '])('returns false for the invalid css selector %p', (selector: string) => {
    expect(isValidCssSelector(selector)).toBe(false)
  })
})
