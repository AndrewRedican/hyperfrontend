import { describe, expect, it } from '@hyperfrontend/testing'
import { shellPackageName } from './shell-package-name'

describe('shellPackageName', () => {
  it('names the shell package after the feature', () => {
    expect(shellPackageName('clock')).toBe('clock-shell')
  })

  it('keeps the scope of a scoped feature name', () => {
    expect(shellPackageName('@acme/clock')).toBe('@acme/clock-shell')
  })
})
