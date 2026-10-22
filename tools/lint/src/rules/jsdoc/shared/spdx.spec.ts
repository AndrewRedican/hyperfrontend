import { describe, expect, it } from '@hyperfrontend/testing'
import { isLicenseExpression } from './spdx.ts'

describe('isLicenseExpression', () => {
  it('accepts a grouped choice with an exception and a later version', () => {
    expect(isLicenseExpression('(MIT OR GPL-2.0+ WITH Classpath-exception-2.0) AND Apache-2.0')).toBe(true)
  })

  it('accepts a document reference', () => {
    expect(isLicenseExpression('DocumentRef-spdx:LicenseRef-custom')).toBe(true)
  })

  it('refuses an unknown identifier', () => {
    expect(isLicenseExpression('MIT-7')).toBe(false)
  })

  it('refuses an unknown exception', () => {
    expect(isLicenseExpression('MIT WITH nothing')).toBe(false)
  })

  it('refuses an unclosed group', () => {
    expect(isLicenseExpression('(MIT OR ISC')).toBe(false)
  })

  it('refuses a dangling operator', () => {
    expect(isLicenseExpression('MIT AND')).toBe(false)
  })

  it('refuses words after a complete expression', () => {
    expect(isLicenseExpression('MIT extra')).toBe(false)
  })

  it('refuses a group with an invalid choice inside', () => {
    expect(isLicenseExpression('(FOO)')).toBe(false)
  })

  it('refuses an exception left out', () => {
    expect(isLicenseExpression('MIT WITH')).toBe(false)
  })

  it('refuses a document reference without a license reference', () => {
    expect(isLicenseExpression('DocumentRef-spdx:MIT')).toBe(false)
  })

  it('refuses a malformed document reference', () => {
    expect(isLicenseExpression('Doc:LicenseRef-a')).toBe(false)
  })
})
