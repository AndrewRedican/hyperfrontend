import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { isValidPid } from './is-valid-pid'

describe('isValidPid', () => {
  it('returns true for a valid process id', () => {
    expect(isValidPid(uuidV4())).toBe(true)
  })

  it('returns false for an invalid process id', () => {
    expect(isValidPid(void 0)).toBe(false)
    expect(isValidPid(null)).toBe(false)
    expect(isValidPid(0)).toBe(false)
    expect(isValidPid('')).toBe(false)
    expect(isValidPid('1sdfw4')).toBe(false)
    expect(isValidPid({})).toBe(false)
  })
})
