import { describe, expect, it } from '@hyperfrontend/testing'

describe('a suite that fails on purpose', () => {
  it('fails a matcher', () => {
    expect(1 + 1).toBe(3)
  })

  it('declares an assertion it never makes', () => {
    expect.assertions(1)
  })

  it('passes, so the run is not all failures', () => {
    expect(true).toBe(true)
  })
})
