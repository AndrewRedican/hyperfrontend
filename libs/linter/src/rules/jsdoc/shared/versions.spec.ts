import { describe, expect, it } from '@hyperfrontend/testing'
import { isSemver } from './versions'

describe('isSemver', () => {
  it('accepts a version with a prefix, a pre-release and a build', () => {
    expect(isSemver('v1.2.3-beta.1+build.007')).toBe(true)
  })

  it('accepts a version prefixed with an equals sign', () => {
    expect(isSemver('=0.0.0')).toBe(true)
  })

  it('refuses two numbers', () => {
    expect(isSemver('3.1')).toBe(false)
  })

  it('refuses a leading zero', () => {
    expect(isSemver('01.2.3')).toBe(false)
  })

  it('refuses a numeric pre-release with a leading zero', () => {
    expect(isSemver('1.2.3-01')).toBe(false)
  })

  it('refuses an empty build', () => {
    expect(isSemver('1.2.3+')).toBe(false)
  })
})
