import type { Node } from '../../../code/model'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { describe, expect, it } from '@hyperfrontend/testing'
import { childrenOf } from '../../../code/children'
import { parseCode } from '../../../code/parse'
import { constructionKindOf, dependencyOf, joinEnglish, propertyPathOf, recommend } from './dependencies'

/**
 * The expression a text parses to, as the initialiser of a declaration.
 *
 * @param text - The expression's source, parsed as an initialiser
 * @returns The expression node
 */
function expression(text: string): Node {
  const program = parseCode(`const value = ${text}`, '.tsx').tree as Node
  const declaration = (program.body as readonly Node[])[0] as Node
  return ((declaration.declarations as readonly Node[])[0] as Node).init as Node
}

/**
 * The first identifier of a name in a statement's tree, in source order.
 *
 * @param text - The statement's text
 * @param name - The name searched for
 * @returns The identifier node
 */
function identifier(text: string, name: string): Node {
  const pending = [parseCode(text, '.tsx').tree as Node]
  for (let node = pending.shift(); node !== undefined; node = pending.shift()) {
    if (node.kind === 'Identifier' && node.name === name) return node
    pending.unshift(...childrenOf(node))
  }
  throw createError(`no identifier ${name}`)
}

/**
 * The source text of a node.
 *
 * @param text - The text parsed
 * @param node - The node whose span is read
 * @returns The node's text
 */
function textOf(text: string, node: Node): string {
  return text.slice(node.start, node.end)
}

describe('recommend', () => {
  const base = { stable: createSet<string>(), external: createSet<string>(), isEffect: false }
  it('finds a missing path', () => {
    expect([...recommend({ ...base, used: ['a'], declared: [] }).missing]).toEqual(['a'])
  })
  it('covers a deeper path by a declared parent', () => {
    expect(recommend({ ...base, used: ['a.b.c'], declared: ['a.b'] }).suggested).toEqual(['a.b'])
  })
  it('counts a declared path twice as a duplicate', () => {
    expect([...recommend({ ...base, used: ['a'], declared: ['a', 'a'] }).duplicate]).toEqual(['a'])
  })
  it('lets an effect declare more than it uses', () => {
    expect(recommend({ ...base, isEffect: true, used: [], declared: ['b', 'b'] }).suggested).toEqual(['b'])
  })
  it('finds an unnecessary ref read in an effect', () => {
    expect([...recommend({ ...base, isEffect: true, used: [], declared: ['r.current'] }).unnecessary]).toEqual(['r.current'])
  })
  it('finds an unnecessary outer value in an effect', () => {
    expect([...recommend({ ...base, isEffect: true, external: createSet(['x']), used: [], declared: ['x'] }).unnecessary]).toEqual(['x'])
  })
  it('treats a stable path as satisfied', () => {
    expect(recommend({ ...base, stable: createSet(['s']), used: ['s'], declared: [] }).missing.size).toBe(0)
  })
  it('searches under a path used only below', () => {
    expect([...recommend({ ...base, used: ['a.b', 'a.c'], declared: ['a.b'] }).missing]).toEqual(['a.c'])
  })
})

describe('propertyPathOf', () => {
  it('reads an identifier', () => {
    expect(propertyPathOf(expression('a'), null)).toBe('a')
  })
  it('reads a member chain', () => {
    expect(propertyPathOf(expression('a.b.c'), null)).toBe('a.b.c')
  })
  it('marks an optional read', () => {
    const optional = createMap<string, boolean>()
    propertyPathOf(expression('a?.b'), optional)
    expect(optional.get('a.b')).toBe(true)
  })
  it('keeps a required read over a later optional one', () => {
    const optional = createMap<string, boolean>()
    propertyPathOf(expression('a.b'), optional)
    propertyPathOf(expression('a?.b'), optional)
    expect(optional.get('a.b')).toBe(false)
  })
  it('rejects an optional call', () => {
    expect(propertyPathOf(expression('a?.()'), null)).toBe(null)
  })
  it('rejects a computed member', () => {
    expect(propertyPathOf(expression('a[b]'), null)).toBe(null)
  })
  it('rejects a member of something that is no path', () => {
    expect(propertyPathOf(expression('a[0].b'), null)).toBe(null)
  })
})

describe('dependencyOf', () => {
  const read = 'f(a.b.c)'
  it('follows a member chain', () => {
    expect(textOf(read, dependencyOf(identifier(read, 'a')))).toBe('a.b.c')
  })
  const current = 'f(r.current.x)'
  it('stops before current', () => {
    expect(textOf(current, dependencyOf(identifier(current, 'r')))).toBe('r')
  })
  const method = 'a.b.go()'
  it('stops before a method call', () => {
    expect(textOf(method, dependencyOf(identifier(method, 'a')))).toBe('a.b')
  })
  const assigned = 'a.b.c = 1'
  it('takes the object of an assignment target', () => {
    expect(textOf(assigned, dependencyOf(identifier(assigned, 'a')))).toBe('a.b')
  })
  const computed = 'f(a[b])'
  it('stops at a computed member', () => {
    expect(textOf(computed, dependencyOf(identifier(computed, 'a')))).toBe('a')
  })
})

describe('constructionKindOf', () => {
  const cases: readonly (readonly [string, string | null])[] = [
    ['{}', 'object'],
    ['[]', 'array'],
    ['() => 1', 'function'],
    ['function () {}', 'function'],
    ['class {}', 'class'],
    ['a ? {} : 1', 'conditional'],
    ['a ? 1 : []', 'conditional'],
    ['a ? 1 : 2', null],
    ['a || {}', 'logical expression'],
    ['{} || a', 'logical expression'],
    ['a || b', null],
    ['<></>', 'JSX fragment'],
    ['<a />', 'JSX element'],
    ['b = {}', 'assignment expression'],
    ['b = 1', null],
    ['new A()', 'object construction'],
    ['/a/', 'regular expression'],
    ['1', null],
    ['{} as A', 'object'],
    ['a', null],
  ]
  for (const [text, kind] of cases) {
    it(`reads ${text}`, () => {
      expect(constructionKindOf(expression(text))).toBe(kind)
    })
  }
})

describe('joinEnglish', () => {
  it('joins one name', () => {
    expect(joinEnglish(['a'])).toBe('a')
  })
  it('joins two names', () => {
    expect(joinEnglish(['a', 'b'])).toBe('a and b')
  })
  it('joins three names', () => {
    expect(joinEnglish(['a', 'b', 'c'])).toBe('a, b, and c')
  })
})
