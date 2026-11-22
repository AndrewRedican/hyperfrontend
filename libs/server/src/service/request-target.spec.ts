import { describe, expect, it } from '@hyperfrontend/testing'
import { canonicalTarget, queryView } from './request-target'

describe('canonicalTarget', () => {
  describe('accepts', () => {
    it.each([
      ['the root', '/', { path: '/', query: '' }],
      ['a plain path', '/tickets/7', { path: '/tickets/7', query: '' }],
      ['an encoded space', '/a%20b', { path: '/a b', query: '' }],
      ['a trailing slash, which it keeps', '/a/', { path: '/a/', query: '' }],
      ['encoded text outside ASCII', '/caf%C3%A9', { path: '/caf\u00e9', query: '' }],
      ['an encoded no-break space', '/a%C2%A0b', { path: '/a\u00a0b', query: '' }],
      ['a query, which it keeps raw', '/search?q=a%20b&q=c+d', { path: '/search', query: 'q=a%20b&q=c+d' }],
      ['a question mark with nothing after it', '/search?', { path: '/search', query: '' }],
      ['a second question mark as part of the query', '/search?a=1?b=2', { path: '/search', query: 'a=1?b=2' }],
      ['an encoded percent sign as a literal percent', '/100%25', { path: '/100%', query: '' }],
      ['a percent escape of a percent escape, decoded once', '/a%252Fb', { path: '/a%2Fb', query: '' }],
      ['a colon and an asterisk inside a segment', '/items:batch/a*b', { path: '/items:batch/a*b', query: '' }],
      ['a segment that only starts with dots', '/.well-known/...', { path: '/.well-known/...', query: '' }],
      ['an encoded slash in the query', '/a?next=%2Fb', { path: '/a', query: 'next=%2Fb' }],
    ])('%s', (_title, url, expected) => {
      expect(canonicalTarget(url)).toEqual(expected)
    })
  })

  describe('refuses', () => {
    it.each([
      ['absolute-form', 'http://host.example/a'],
      ['the asterisk form', '*'],
      ['authority-form', 'host.example:443'],
      ['an empty target', ''],
      ['a raw next-line control', '/a\u0085b'],
      ['raw text outside ASCII', '/caf\u00e9'],
      ['a raw unit above the tilde in the query', '/a?q=\u00e9'],
      ['a raw space', '/a b'],
      ['a raw tab in the query', '/a?q=\t'],
      ['a raw delete character', '/a\u007f'],
      ['a raw delete character in the query', '/a?q=\u007f'],
      ['a lone percent sign', '/%'],
      ['a percent escape that is not hexadecimal', '/%zz'],
      ['a percent escape that is not UTF-8', '/%c3%28'],
      ['an encoded slash', '/a%2Fb'],
      ['an encoded slash in lower case', '/a%2fb'],
      ['an encoded backslash', '/a%5Cb'],
      ['a raw backslash', '/a\\b'],
      ['an encoded NUL', '/a%00'],
      ['an encoded line feed', '/a%0A'],
      ['an encoded unit separator', '/a%1F'],
      ['an encoded delete character', '/a%7F'],
      ['an encoded next-line control', '/a%C2%85'],
      ['an encoded control sequence introducer', '/a%C2%9B'],
      ['the last C1 control, encoded', '/a%C2%9F'],
      ['an encoded line separator', '/a%E2%80%A8'],
      ['an encoded paragraph separator', '/a%E2%80%A9'],
      ['an encoded right-to-left override', '/a%E2%80%AE'],
      ['an encoded left-to-right embedding', '/a%E2%80%AA'],
      ['an encoded left-to-right isolate', '/a%E2%81%A6'],
      ['an encoded pop directional isolate', '/a%E2%81%A9'],
      ['an encoded left-to-right mark', '/a%E2%80%8E'],
      ['an encoded right-to-left mark', '/a%E2%80%8F'],
      ['an encoded Arabic letter mark', '/a%D8%9C'],
      ['a dot segment', '/a/./b'],
      ['a trailing dot segment', '/a/.'],
      ['a double-dot segment', '/a/../b'],
      ['a trailing double-dot segment', '/..'],
      ['an encoded double-dot segment', '/%2e%2e/b'],
      ['an encoded dot segment', '/a/%2E'],
      ['an empty interior segment', '/a//b'],
      ['an empty first segment', '//a'],
      ['two trailing slashes', '/a//'],
    ])('%s', (_title, url) => {
      expect(canonicalTarget(url)).toBeNull()
    })
  })

  describe('at the edges of what it refuses', () => {
    it.each([
      ['the character after the C1 controls', '/a%C2%A0', '/a\u00a0'],
      ['the character before the Arabic letter mark', '/a%D8%9B', '/a\u061b'],
      ['the character after the Arabic letter mark', '/a%D8%9D', '/a\u061d'],
      ['the character before the directional marks', '/a%E2%80%8D', '/a\u200d'],
      ['the character after the directional marks', '/a%E2%80%90', '/a\u2010'],
      ['the character before the line separator', '/a%E2%80%A7', '/a\u2027'],
      ['the character after the embedding controls', '/a%E2%80%AF', '/a\u202f'],
      ['the character before the isolates', '/a%E2%81%A5', '/a\u2065'],
      ['the character after the isolates', '/a%E2%81%AA', '/a\u206a'],
      ['a tilde, the last raw unit allowed', '/~a', '/~a'],
      ['an exclamation mark, the first raw unit allowed', '/!a', '/!a'],
      ['the character before the controls end, a space', '/a%20', '/a '],
    ])('accepts %s', (_title, url, path) => {
      expect(canonicalTarget(url)).toEqual({ path, query: '' })
    })
  })
})

describe('queryView', () => {
  it('reads the first value under a name', () => {
    expect(queryView('service=upload&service=receive').get('service')).toBe('upload')
  })

  it('reads null for a name that is absent', () => {
    expect(queryView('service=upload').get('other')).toBeNull()
  })

  it('lists every value under a name in the order sent', () => {
    expect(queryView('tag=b&other=1&tag=a&tag=c').getAll('tag')).toEqual(['b', 'a', 'c'])
  })

  it('lists nothing for a name that is absent', () => {
    expect(queryView('tag=b').getAll('other')).toEqual([])
  })

  it('tells a name that occurs from one that does not', () => {
    const view = queryView('flag&tag=b')
    expect({ flag: view.has('flag'), tag: view.has('tag'), other: view.has('other') }).toEqual({ flag: true, tag: true, other: false })
  })

  it('compares names exactly', () => {
    expect(queryView('Tag=b').has('tag')).toBe(false)
  })

  it('decodes a plus sign as a space', () => {
    expect(queryView('q=a+b').get('q')).toBe('a b')
  })

  it('decodes percent escapes in names and values', () => {
    expect(queryView('caf%C3%A9=%2Fa%26b').get('caf\u00e9')).toBe('/a&b')
  })

  it('reads a malformed escape without failing', () => {
    expect(queryView('q=%zz').get('q')).toBe('%zz')
  })

  it('reads an empty query as no names at all', () => {
    expect(queryView('').has('')).toBe(false)
  })

  it('is frozen', () => {
    expect(Object.isFrozen(queryView('a=1'))).toBe(true)
  })
})
