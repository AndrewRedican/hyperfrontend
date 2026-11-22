import type { ParsedPattern } from './route-pattern'
import { describe, expect, it } from '@hyperfrontend/testing'
import { comparePatterns, isStaticPattern, matchPattern, parsePattern } from './route-pattern'

/**
 * Parses a pattern the spec knows to be valid.
 *
 * @param pattern - The pattern as written.
 * @returns The parsed segments.
 */
const parsed = (pattern: string): ParsedPattern => {
  const result = parsePattern(pattern)
  if (typeof result === 'string') {
    throw new Error(`the spec's own pattern is faulty: ${result}`)
  }
  return result
}

/**
 * Matches a canonical path against a pattern, splitting the path the way the listener's canonical path splits.
 *
 * @param pattern - The pattern as written.
 * @param canonical - The canonical path.
 * @returns The params as a plain object, or `null` when the path does not match.
 */
const match = (pattern: string, canonical: string): Record<string, string> | null => {
  const params = matchPattern(parsed(pattern), canonical.slice(1).split('/'))
  return params === null ? null : { ...params }
}

/**
 * Sorts patterns from the most specific to the least.
 *
 * @param patterns - The patterns as written, in any order.
 * @returns The same patterns, most specific first.
 */
const sorted = (patterns: readonly string[]): string[] => [...patterns].sort((a, b) => comparePatterns(parsed(a), parsed(b)))

describe('parsePattern', () => {
  it('parses the root as a pattern without segments', () => {
    expect(parsePattern('/')).toEqual([])
  })

  it('parses static segments', () => {
    expect(parsePattern('/tickets/open')).toEqual([
      { kind: 'static', text: 'tickets' },
      { kind: 'static', text: 'open' },
    ])
  })

  it('parses a param by its name', () => {
    expect(parsePattern('/tickets/:id')).toEqual([
      { kind: 'static', text: 'tickets' },
      { kind: 'param', text: 'id' },
    ])
  })

  it('parses a wildcard by its name', () => {
    expect(parsePattern('/files/*rest')).toEqual([
      { kind: 'static', text: 'files' },
      { kind: 'wildcard', text: 'rest' },
    ])
  })

  it('reads a colon or a star after the first character as static text', () => {
    expect(parsePattern('/items:batch/a*b')).toEqual([
      { kind: 'static', text: 'items:batch' },
      { kind: 'static', text: 'a*b' },
    ])
  })

  it('keeps a static segment as written, decoded text included', () => {
    expect(parsePattern('/café/a b/100%')).toEqual([
      { kind: 'static', text: 'café' },
      { kind: 'static', text: 'a b' },
      { kind: 'static', text: '100%' },
    ])
  })

  it('accepts a name that starts with an underscore and holds digits', () => {
    expect(parsePattern('/:_id2/*_rest9')).toEqual([
      { kind: 'param', text: '_id2' },
      { kind: 'wildcard', text: '_rest9' },
    ])
  })

  it('freezes what it parsed', () => {
    const pattern = parsed('/tickets/:id')
    expect([Object.isFrozen(pattern), ...pattern.map((segment) => Object.isFrozen(segment))]).toEqual([true, true, true])
  })

  it.each([['tickets'], [''], [':id'], [undefined], [7], [['/a']]])('refuses %p, which does not start with a slash', (pattern) => {
    expect(parsePattern(pattern)).toBe('the pattern must start with "/".')
  })

  it.each([['/tickets/'], ['//'], ['/tickets/:id/']])('refuses %p, which ends with a slash', (pattern) => {
    expect(parsePattern(pattern)).toBe('the pattern must not end with "/".')
  })

  it.each([['/tickets//open'], ['//tickets']])('refuses %p, which has an empty segment', (pattern) => {
    expect(parsePattern(pattern)).toBe('the pattern has an empty segment.')
  })

  it.each([
    ['/a/.', 2],
    ['/../a', 1],
    ['/a/b\\c', 2],
    ['/a/b/c\u0000d', 3],
    ['/tab\there', 1],
    ['/a\u007f', 1],
    ['/a\u0085', 1],
    ['/a\u009f', 1],
    ['/a\u2028', 1],
    ['/a\u2029', 1],
    ['/a\u202e', 1],
    ['/a\u2066', 1],
    ['/a\u200f', 1],
    ['/a\u061c', 1],
  ])('refuses %j, whose static segment %d no canonical path holds', (pattern, position) => {
    expect(parsePattern(pattern)).toBe(`segment ${position} can never match a canonical path.`)
  })

  it.each([['/a/...'], ['/a/.well-known'], ['/a b'], ['/a\u00a0b'], ['/aé'], ['/中文']])('accepts the static text of %j', (pattern) => {
    expect(typeof parsePattern(pattern)).toBe('object')
  })

  it.each([
    ['/:', 1],
    ['/a/*', 2],
    ['/a/:1st', 2],
    ['/a/b/:first-name', 3],
    ['/*re.st', 1],
    ['/:café', 1],
  ])('refuses %p, whose segment %d has no usable name', (pattern, position) => {
    expect(parsePattern(pattern)).toBe(`segment ${position} needs a name of letters, digits and "_", not starting with a digit.`)
  })

  it('refuses a param named __proto__', () => {
    expect(parsePattern('/a/:__proto__')).toBe('segment 2 needs a name of letters, digits and "_", not starting with a digit.')
  })

  it('refuses a wildcard named __proto__', () => {
    expect(parsePattern('/*__proto__')).toBe('segment 1 needs a name of letters, digits and "_", not starting with a digit.')
  })

  it('refuses a param declared twice', () => {
    expect(parsePattern('/:id/b/:id')).toBe('the parameter "id" is declared twice.')
  })

  it('refuses a wildcard that repeats the name of a param', () => {
    expect(parsePattern('/:rest/*rest')).toBe('the parameter "rest" is declared twice.')
  })

  it('accepts a param whose name is the text of a static segment', () => {
    expect(parsePattern('/id/:id')).toEqual([
      { kind: 'static', text: 'id' },
      { kind: 'param', text: 'id' },
    ])
  })

  it('refuses a wildcard that is not the last segment', () => {
    expect(parsePattern('/files/*rest/raw')).toBe('a wildcard must be the last segment.')
  })

  it('names the leftmost faulty segment of a pattern with several', () => {
    expect(parsePattern('/*rest/:1/..')).toBe('a wildcard must be the last segment.')
  })
})

describe('matchPattern', () => {
  it.each([
    ['/', '/', {}],
    ['/a', '/a', {}],
    ['/a/:id', '/a/7', { id: '7' }],
    ['/a/:id', '/a/x y', { id: 'x y' }],
    ['/a/:id/b', '/a/7/b', { id: '7' }],
    ['/files/*rest', '/files/a', { rest: 'a' }],
    ['/files/*rest', '/files/a/b', { rest: 'a/b' }],
    ['/files/*rest', '/files/a/', { rest: 'a/' }],
    ['/:tenant/*rest', '/t1/x/y', { tenant: 't1', rest: 'x/y' }],
    ['/items:batch', '/items:batch', {}],
    ['/café/:name', '/café/zoë', { name: 'zoë' }],
    ['/*all', '/a', { all: 'a' }],
  ])('matches %p against %p', (pattern, path, params) => {
    expect(match(pattern, path)).toEqual(params)
  })

  it.each([
    ['/', '/a'],
    ['/', '//'],
    ['/a', '/a/'],
    ['/a', '/A'],
    ['/a', '/a/b'],
    ['/a', '/'],
    ['/a/b', '/a'],
    ['/a/:id', '/a/'],
    ['/a/:id', '/a'],
    ['/a/:id', '/a/7/'],
    ['/a/:id', '/a/7/b'],
    ['/a/:id/b', '/a/7/c'],
    ['/files/*rest', '/files'],
    ['/files/*rest', '/files/'],
    ['/files/*rest', '/other/a'],
    ['/*all', '/'],
  ])('does not match %p against %p', (pattern, path) => {
    expect(match(pattern, path)).toBeNull()
  })

  it('returns params without a prototype', () => {
    expect(Object.getPrototypeOf(matchPattern(parsed('/a/:id'), ['a', '7']))).toBeNull()
  })

  it('returns params without a prototype for a pattern that declares none', () => {
    expect(Object.getPrototypeOf(matchPattern(parsed('/'), ['']))).toBeNull()
  })

  it('reads a param named like an inherited member as an own value', () => {
    expect(match('/a/:constructor', '/a/7')).toEqual({ constructor: '7' })
  })
})

describe('comparePatterns', () => {
  it.each([
    [['/a/b', '/a/:x', '/*all'], '/a/b'],
    [['/a/:x', '/:y/b'], '/a/:x'],
    [['/:y/b', '/:y/:z'], '/:y/b'],
    [['/a/:x/c', '/a/*rest'], '/a/:x/c'],
    [['/a/*rest', '/:x/b'], '/a/*rest'],
  ])('puts the most specific of %j first', (candidates, winner) => {
    expect(sorted(candidates)[0]).toBe(winner)
  })

  it.each([
    [['/a/b', '/a/:x', '/*all'], '/a/b'],
    [['/a/:x', '/:y/b'], '/a/:x'],
    [['/:y/b', '/:y/:z'], '/:y/b'],
    [['/a/:x/c', '/a/*rest'], '/a/:x/c'],
    [['/a/*rest', '/:x/b'], '/a/*rest'],
  ])('puts the most specific of %j first when they come reversed', (candidates, winner) => {
    expect(sorted([...candidates].reverse())[0]).toBe(winner)
  })

  it('ties two patterns of the same kinds at every position', () => {
    expect(comparePatterns(parsed('/a/:x/*rest'), parsed('/b/:y/*tail'))).toBe(0)
  })

  it('ties the root with itself', () => {
    expect(comparePatterns(parsed('/'), parsed('/'))).toBe(0)
  })

  it('orders a pattern that ends after one that goes on, so that the order is total', () => {
    expect([comparePatterns(parsed('/a'), parsed('/a/b')) > 0, comparePatterns(parsed('/a/b'), parsed('/a')) < 0]).toEqual([true, true])
  })

  it('sorts a table the same way for every input order', () => {
    const table = ['/*all', '/:y/:z', '/a/:x', '/a/b', '/:y/b', '/a/*rest']
    const orders = [table, [...table].reverse(), [table[3], table[0], table[5], table[1], table[4], table[2]] as string[]]
    expect(orders.map(sorted)).toEqual(Array.from({ length: 3 }, () => ['/a/b', '/a/:x', '/a/*rest', '/:y/b', '/:y/:z', '/*all']))
  })
})

describe('isStaticPattern', () => {
  it.each([['/healthz'], ['/internal/ready'], ['/']])('accepts %p', (pattern) => {
    expect(isStaticPattern(pattern)).toBe(true)
  })

  it.each([['/probe/:name'], ['/probe/*rest'], ['/healthz/'], ['healthz'], [undefined], ['/a//b']])('refuses %p', (pattern) => {
    expect(isStaticPattern(pattern)).toBe(false)
  })
})
