import { beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTokenParser, TokenType } from './token-parser'

describe('TokenType', () => {
  it('exposes the token discriminators', () => {
    expect(TokenType).toEqual({ Key: 'key', Paste: 'paste', Resize: 'resize' })
  })
})

describe('createTokenParser', () => {
  let parser: ReturnType<typeof createTokenParser>

  beforeEach(() => {
    parser = createTokenParser()
  })

  describe('key tokens', () => {
    it('tokenizes a single printable character as a key', () => {
      expect(parser.feed('a')).toEqual([{ type: TokenType.Key, value: 'a' }])
    })

    it('tokenizes an arrow sequence as a key', () => {
      expect(parser.feed('\x1B[A')).toEqual([{ type: TokenType.Key, value: '\x1B[A' }])
    })

    it('tokenizes the delete sequence as a key', () => {
      expect(parser.feed('\x1B[3~')).toEqual([{ type: TokenType.Key, value: '\x1B[3~' }])
    })

    it('tokenizes an SS3 sequence as a key', () => {
      expect(parser.feed('\x1BOA')).toEqual([{ type: TokenType.Key, value: '\x1BOA' }])
    })

    it('tokenizes carriage return as a key', () => {
      expect(parser.feed('\r')).toEqual([{ type: TokenType.Key, value: '\r' }])
    })

    it('splits escape followed by an ordinary character into two keys', () => {
      expect(parser.feed('\x1Bz')).toEqual([
        { type: TokenType.Key, value: '\x1B' },
        { type: TokenType.Key, value: 'z' },
      ])
    })
  })

  describe('printable runs', () => {
    it('treats a multi-character run as a paste', () => {
      expect(parser.feed('hello')).toEqual([{ type: TokenType.Paste, value: 'hello' }])
    })

    it('splits a mixed chunk into runs and escape keys', () => {
      expect(parser.feed('ab\x1B[Ac')).toEqual([
        { type: TokenType.Paste, value: 'ab' },
        { type: TokenType.Key, value: '\x1B[A' },
        { type: TokenType.Key, value: 'c' },
      ])
    })

    it('keeps embedded carriage returns inside a run', () => {
      expect(parser.feed('first\rsecond')).toEqual([{ type: TokenType.Paste, value: 'first\rsecond' }])
    })
  })

  describe('Ctrl+C', () => {
    it('tokenizes a lone Ctrl+C as a key', () => {
      expect(parser.feed('\x03')).toEqual([{ type: TokenType.Key, value: '\x03' }])
    })

    it('splits Ctrl+C out of a printable run', () => {
      expect(parser.feed('ab\x03cd')).toEqual([
        { type: TokenType.Paste, value: 'ab' },
        { type: TokenType.Key, value: '\x03' },
        { type: TokenType.Paste, value: 'cd' },
      ])
    })

    it('keeps Ctrl+C inside a bracketed paste as data', () => {
      expect(parser.feed('\x1B[200~a\x03b\x1B[201~')).toEqual([{ type: TokenType.Paste, value: 'a\x03b' }])
    })
  })

  describe('bracketed paste', () => {
    it('tokenizes a bracketed paste in one chunk', () => {
      expect(parser.feed('\x1B[200~pasted text\x1B[201~')).toEqual([{ type: TokenType.Paste, value: 'pasted text' }])
    })

    it('accumulates a paste body across chunks', () => {
      expect(parser.feed('\x1B[200~he')).toEqual([])
      expect(parser.feed('llo')).toEqual([])
      expect(parser.feed('\x1B[201~x')).toEqual([
        { type: TokenType.Paste, value: 'hello' },
        { type: TokenType.Key, value: 'x' },
      ])
    })

    it('handles an end marker split across chunks', () => {
      expect(parser.feed('\x1B[200~abc\x1B[2')).toEqual([])
      expect(parser.feed('01~')).toEqual([{ type: TokenType.Paste, value: 'abc' }])
    })

    it('handles a start marker split across chunks', () => {
      expect(parser.feed('\x1B[20')).toEqual([])
      expect(parser.feed('0~hi\x1B[201~')).toEqual([{ type: TokenType.Paste, value: 'hi' }])
    })

    it('preserves escape sequences inside the paste body', () => {
      expect(parser.feed('\x1B[200~a\x1B[31mb\x1B[201~')).toEqual([{ type: TokenType.Paste, value: 'a\x1B[31mb' }])
    })

    it('drops a stray end marker outside a paste', () => {
      expect(parser.feed('\x1B[201~y')).toEqual([{ type: TokenType.Key, value: 'y' }])
    })

    it('tokenizes keys after a completed paste in the same chunk', () => {
      expect(parser.feed('\x1B[200~hi\x1B[201~\x1B[B')).toEqual([
        { type: TokenType.Paste, value: 'hi' },
        { type: TokenType.Key, value: '\x1B[B' },
      ])
    })
  })

  describe('partial escape sequences', () => {
    it('carries a partial CSI sequence to the next chunk', () => {
      expect(parser.feed('\x1B[')).toEqual([])
      expect(parser.feed('B')).toEqual([{ type: TokenType.Key, value: '\x1B[B' }])
    })

    it('carries a trailing lone escape to the next chunk', () => {
      expect(parser.feed('a\x1B')).toEqual([{ type: TokenType.Key, value: 'a' }])
      expect(parser.feed('[C')).toEqual([{ type: TokenType.Key, value: '\x1B[C' }])
    })

    it('carries a partial SS3 sequence to the next chunk', () => {
      expect(parser.feed('\x1BO')).toEqual([])
      expect(parser.feed('B')).toEqual([{ type: TokenType.Key, value: '\x1BOB' }])
    })
  })
})
