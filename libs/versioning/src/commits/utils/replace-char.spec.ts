import { describe, expect, it } from '@hyperfrontend/testing'
import { hyphenToSpace, replaceChar } from './replace-char'

describe('replaceChar', () => {
  it('replaces all occurrences of target character', () => {
    expect(replaceChar('a-b-c', '-', ' ')).toBe('a b c')
  })

  it('handles empty string', () => {
    expect(replaceChar('', '-', ' ')).toBe('')
  })

  it('handles string without target', () => {
    expect(replaceChar('abc', '-', ' ')).toBe('abc')
  })

  it('handles consecutive targets', () => {
    expect(replaceChar('a--b', '-', ' ')).toBe('a  b')
  })

  it('handles target at start and end', () => {
    expect(replaceChar('-a-b-', '-', ' ')).toBe(' a b ')
  })

  it('replaces any character', () => {
    expect(replaceChar('a/b/c', '/', '-')).toBe('a-b-c')
  })
})

describe('hyphenToSpace', () => {
  it('replaces hyphens with spaces', () => {
    expect(hyphenToSpace('BREAKING-CHANGE')).toBe('BREAKING CHANGE')
  })

  it('handles multiple hyphens', () => {
    expect(hyphenToSpace('one-two-three')).toBe('one two three')
  })

  it('handles string without hyphens', () => {
    expect(hyphenToSpace('BREAKING CHANGE')).toBe('BREAKING CHANGE')
  })
})
