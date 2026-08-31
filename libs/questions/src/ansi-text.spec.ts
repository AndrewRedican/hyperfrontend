import { describe, expect, it } from '@hyperfrontend/testing'
import { matchAnsiSequence, stripAnsi, displayWidth, Esc } from './ansi-text'

describe('Esc', () => {
  it('is the escape character', () => {
    expect(Esc).toBe('\x1B')
  })
})

describe('matchAnsiSequence', () => {
  it('matches a complete CSI arrow sequence', () => {
    expect(matchAnsiSequence('\x1B[A', 0)).toEqual({ length: 3, complete: true })
  })

  it('matches a CSI sequence with parameter bytes', () => {
    expect(matchAnsiSequence('\x1B[200~rest', 0)).toEqual({ length: 6, complete: true })
  })

  it('matches a CSI sequence at a non-zero offset', () => {
    expect(matchAnsiSequence('ab\x1B[3~', 2)).toEqual({ length: 4, complete: true })
  })

  it('reports an incomplete CSI sequence cut at the chunk end', () => {
    expect(matchAnsiSequence('\x1B[20', 0)).toEqual({ length: 4, complete: false })
  })

  it('reports a lone trailing escape as incomplete', () => {
    expect(matchAnsiSequence('\x1B', 0)).toEqual({ length: 1, complete: false })
  })

  it('matches a complete SS3 sequence', () => {
    expect(matchAnsiSequence('\x1BOA', 0)).toEqual({ length: 3, complete: true })
  })

  it('reports an SS3 sequence missing its final byte as incomplete', () => {
    expect(matchAnsiSequence('\x1BO', 0)).toEqual({ length: 2, complete: false })
  })

  it('treats escape followed by an ordinary character as a lone escape', () => {
    expect(matchAnsiSequence('\x1Bz', 0)).toEqual({ length: 1, complete: true })
  })

  it('ends a malformed CSI sequence at the first out-of-range byte', () => {
    // why: 0xFC is neither a parameter nor a final byte, so it stays unconsumed
    expect(matchAnsiSequence('\x1B[1\xFC', 0)).toEqual({ length: 3, complete: true })
  })
})

describe('stripAnsi', () => {
  it('removes color codes around text', () => {
    expect(stripAnsi('\x1B[36mhello\x1B[0m')).toBe('hello')
  })

  it('returns plain text unchanged', () => {
    expect(stripAnsi('plain')).toBe('plain')
  })

  it('drops a trailing partial escape sequence', () => {
    expect(stripAnsi('ab\x1B[')).toBe('ab')
  })
})

describe('displayWidth', () => {
  it('counts plain characters', () => {
    expect(displayWidth('hello')).toBe(5)
  })

  it('excludes ANSI escape sequences', () => {
    expect(displayWidth('\x1B[1m\x1B[36mhi\x1B[0m')).toBe(2)
  })

  it('counts an astral code point as one column', () => {
    expect(displayWidth('a\u{1F642}b')).toBe(3)
  })
})
