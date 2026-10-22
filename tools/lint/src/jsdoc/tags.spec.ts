import { describe, expect, it } from '@hyperfrontend/testing'
import { INLINE_TAG_NAMES, TAG_NAMES, TAG_PREFERENCES } from './tags.ts'

describe('the tag tables', () => {
  it('know the common tags', () => {
    expect(['param', 'returns', 'template', 'remarks'].every((name) => TAG_NAMES.has(name))).toBe(true)
  })

  it('prefer the long form of a synonym', () => {
    expect(TAG_PREFERENCES['arg']).toBe('param')
  })

  it('know the link inline tag', () => {
    expect(INLINE_TAG_NAMES.has('link')).toBe(true)
  })
})
