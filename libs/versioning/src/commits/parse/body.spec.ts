import { describe, expect, it } from '@hyperfrontend/testing'
import { parseBody } from './body'

describe('parseBody', () => {
  it('parses a simple body', () => {
    const lines = ['feat: test', '', 'Body content']
    const result = parseBody(lines, 1)

    expect(result?.body).toBe('Body content')
    expect(result?.endIndex).toBe(3)
  })

  it('parses multi-line body', () => {
    const lines = ['feat: test', '', 'Line 1', 'Line 2', 'Line 3']
    const result = parseBody(lines, 1)

    expect(result?.body).toBe('Line 1\nLine 2\nLine 3')
  })

  it('parses body with blank lines', () => {
    const lines = ['feat: test', '', 'First paragraph.', '', 'Second paragraph.']
    const result = parseBody(lines, 1)

    expect(result?.body).toContain('First paragraph.')
    expect(result?.body).toContain('Second paragraph.')
  })

  it('returns undefined when no body', () => {
    const lines = ['feat: test']
    const result = parseBody(lines, 1)

    expect(result).toBeUndefined()
  })

  it('returns undefined when only blank lines', () => {
    const lines = ['feat: test', '', '']
    const result = parseBody(lines, 1)

    expect(result).toBeUndefined()
  })

  it('returns undefined when body position is footer', () => {
    const lines = ['feat: test', '', 'Refs: ABC-123']
    const result = parseBody(lines, 1)

    expect(result).toBeUndefined()
  })

  it('stops at footer line', () => {
    const lines = ['feat: test', '', 'Body content', 'Refs: ABC-123']
    const result = parseBody(lines, 1)

    expect(result?.body).toBe('Body content')
    expect(result?.endIndex).toBe(3)
  })

  it('stops at blank line followed by footer', () => {
    const lines = ['feat: test', '', 'Body here', '', 'Fixes #123']
    const result = parseBody(lines, 1)

    expect(result?.body).toBe('Body here')
  })

  it('skips leading blank lines', () => {
    const lines = ['feat: test', '', '', '', 'Body content']
    const result = parseBody(lines, 1)

    expect(result?.body).toBe('Body content')
  })

  it('trims trailing blank lines', () => {
    const lines = ['feat: test', '', 'Body content', '', '']
    const result = parseBody(lines, 1)

    expect(result?.body).toBe('Body content')
  })

  it('handles text that looks like footer but is not', () => {
    const lines = ['feat: test', '', 'Some text with colon: in middle']
    const result = parseBody(lines, 1)

    expect(result?.body).toBe('Some text with colon: in middle')
  })

  it('detects BREAKING CHANGE footer', () => {
    const lines = ['feat: test', '', 'Body text', 'BREAKING CHANGE: description']
    const result = parseBody(lines, 1)

    expect(result?.body).toBe('Body text')
  })

  it('detects BREAKING-CHANGE footer', () => {
    const lines = ['feat: test', '', 'Body text', 'BREAKING-CHANGE: description']
    const result = parseBody(lines, 1)

    expect(result?.body).toBe('Body text')
  })

  it('does not treat line starting with special character as footer', () => {
    const lines = ['feat: test', '', '@mentions are not footers', '#hashtags too']
    const result = parseBody(lines, 1)

    expect(result?.body).toBe('@mentions are not footers\n#hashtags too')
  })

  it('handles footer with token followed by space-hash pattern', () => {
    const lines = ['feat: test', '', 'Body text', 'Fixes #456']
    const result = parseBody(lines, 1)

    expect(result?.body).toBe('Body text')
  })

  it('does not treat incomplete token-hash pattern as footer', () => {
    const lines = ['feat: test', '', 'Token#123 is not a footer']
    const result = parseBody(lines, 1)

    expect(result?.body).toBe('Token#123 is not a footer')
  })

  it('handles body starting directly at startIndex', () => {
    const lines = ['feat: test', 'Body without blank line']
    const result = parseBody(lines, 1)

    expect(result?.body).toBe('Body without blank line')
  })
})
