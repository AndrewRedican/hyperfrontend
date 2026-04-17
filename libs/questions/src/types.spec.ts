import { PromptResult } from './types'

describe('PromptResult', () => {
  it('contains Submitted value', () => {
    expect(PromptResult.Submitted).toBe('submitted')
  })

  it('contains Cancelled value', () => {
    expect(PromptResult.Cancelled).toBe('cancelled')
  })

  it('is frozen', () => {
    expect(Object.isFrozen(PromptResult)).toBe(true)
  })

  it('has exactly two keys', () => {
    const keys = Object.keys(PromptResult)

    expect(keys).toHaveLength(2)
    expect(keys).toContain('Submitted')
    expect(keys).toContain('Cancelled')
  })
})
