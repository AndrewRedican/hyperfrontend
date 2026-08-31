import { describe, expect, it } from '@hyperfrontend/testing'
import { sanitizePasteText, firstPasteLine } from './paste'

describe('sanitizePasteText', () => {
  it('returns plain text unchanged', () => {
    expect(sanitizePasteText('hello world')).toBe('hello world')
  })

  it('collapses a CRLF into a single space', () => {
    expect(sanitizePasteText('first\r\nsecond')).toBe('first second')
  })

  it('collapses runs of mixed newlines into a single space', () => {
    expect(sanitizePasteText('a\n\r\n\rb')).toBe('a b')
  })

  it('drops a leading newline run', () => {
    expect(sanitizePasteText('\n\nvalue')).toBe('value')
  })

  it('drops a trailing newline run', () => {
    expect(sanitizePasteText('value\n')).toBe('value')
  })

  it('removes non-newline control characters', () => {
    expect(sanitizePasteText('a\x07b\tc\x7Fd')).toBe('abcd')
  })

  it('returns empty for control-only input', () => {
    expect(sanitizePasteText('\x07\x1B')).toBe('')
  })

  it('keeps astral code points intact', () => {
    expect(sanitizePasteText('a\u{1F642}b')).toBe('a\u{1F642}b')
  })
})

describe('firstPasteLine', () => {
  it('returns the whole text when there is no newline', () => {
    expect(firstPasteLine('query')).toBe('query')
  })

  it('cuts at the first line feed', () => {
    expect(firstPasteLine('first\nsecond')).toBe('first')
  })

  it('cuts at the first carriage return', () => {
    expect(firstPasteLine('first\rsecond')).toBe('first')
  })

  it('removes control characters from the first line', () => {
    expect(firstPasteLine('a\x07b\x7Fc\nrest')).toBe('abc')
  })

  it('returns empty when the text starts with a newline', () => {
    expect(firstPasteLine('\nsecond')).toBe('')
  })
})
