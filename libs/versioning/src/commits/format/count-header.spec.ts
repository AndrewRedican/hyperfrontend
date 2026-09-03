import { describe, expect, it } from '@hyperfrontend/testing'
import { countHeaderLength } from './count-header'

describe('countHeaderLength', () => {
  it('counts type + separator + subject', () => {
    expect(countHeaderLength({ type: 'feat' }, 'add login')).toBe('feat: add login'.length)
  })

  it('includes scope in the length', () => {
    expect(countHeaderLength({ type: 'feat', scope: ['core'] }, 'add login')).toBe('feat(core): add login'.length)
  })

  it('includes the breaking marker in the length', () => {
    expect(countHeaderLength({ type: 'feat', scope: ['core'], breaking: true }, 'x')).toBe('feat(core)!: x'.length)
  })

  it('overrides draft.subject with the supplied subject', () => {
    expect(countHeaderLength({ type: 'feat', subject: 'ignored' }, 'used')).toBe('feat: used'.length)
  })

  it('handles an empty subject', () => {
    expect(countHeaderLength({ type: 'feat' }, '')).toBe('feat: '.length)
  })

  it('joins multi-scope with a comma', () => {
    expect(countHeaderLength({ type: 'feat', scope: ['a', 'b'] }, 'x')).toBe('feat(a,b): x'.length)
  })
})
