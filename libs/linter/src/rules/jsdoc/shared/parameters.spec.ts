import type { Node } from '../../../code/model'
import type { Parameter } from './parameters'
import { describe, expect, it } from '@hyperfrontend/testing'
import { childrenOf } from '../../../code/children'
import { parseCode } from '../../../code/parse'
import { flatten, isObjectType, parametersOf } from './parameters'

/** The kinds of node a case's function may be. */
const KINDS = ['FunctionDeclaration', 'FunctionExpression', 'TSDeclareFunction', 'TSMethodSignature']

/**
 * The parameters of the first function of a text.
 *
 * @param text - The code parsed
 * @returns The parameters read
 */
function parameters(text: string): Parameter[] {
  const pending = [parseCode(text, '.ts').tree as Node]
  for (;;) {
    const node = pending.shift() as Node
    if (KINDS.includes(node.kind)) return parametersOf(node)
    pending.push(...childrenOf(node))
  }
}

/**
 * The paths of the first function's first parameter, which is destructured.
 *
 * @param text - The code parsed
 * @returns The dotted paths it destructures
 */
function paths(text: string): readonly string[] {
  const [first] = parameters(text)
  return first?.kind === 'destructured' ? first.flat.names : []
}

describe('parametersOf', () => {
  it('reads names, a this parameter and a parameter property', () => {
    expect(parameters('class A { constructor(private a: string, b = 1) {} }')).toEqual([
      { kind: 'name', name: 'a' },
      { kind: 'name', name: 'b' },
    ])
  })

  it('reads a rest parameter and a rest tuple with a hole', () => {
    expect(parameters('declare function f(...a: string[]); function g(...[b, , c]) {}')).toEqual([
      { kind: 'rest', name: 'a', elements: null },
    ])
  })

  it('reads the elements of a rest tuple', () => {
    expect(parameters('function g(...[b, , c]) {}')).toEqual([{ kind: 'rest', name: null, elements: ['b', undefined, 'c'] }])
  })

  it('reads an identifier typed by an inline object type', () => {
    expect(
      parameters('function f(o: { a: string; b: { c: number }; (): void; new (): A; m(): void; [k: string]: unknown }) {}')[0]
    ).toEqual({
      kind: 'destructured',
      root: 'o',
      annotationName: 'o',
      items: ['a', { kind: 'branch', key: 'b', items: ['c'] }, undefined, undefined, 'm', undefined],
      flat: { names: ['a', 'b', 'b.c', 'm'], rests: [false, false, false, false], hasPropertyRest: false, hasRestElement: false },
    })
  })

  it('reads a defaulted identifier typed by an inline object type without its annotation name', () => {
    expect(parameters('function f(o: { a: string } = { a: "" }) {}')[0]).toMatchObject({ root: 'o', annotationName: undefined })
  })

  it('reads a pattern typed by an inline object type without a root', () => {
    expect(parameters('function f({ a }: { a: string }) {}')[0]).toMatchObject({ root: undefined, annotationName: undefined })
  })

  it('lists the paths of nested object and array patterns', () => {
    expect(paths('function f({ a, b: { c }, d: [e, ...g], h: [i] = [], j: { k } = {}, l = 1, ...m }) {}')).toEqual([
      'a',
      'b',
      'b.c',
      'd',
      'd.0',
      'd.1',
      'h',
      'h.0',
      'j',
      'j.k',
      'l',
      'm',
    ])
  })

  it('records rest properties and elements', () => {
    expect(parameters('function f({ a: [...b], ...c }) {}')[0]).toMatchObject({
      flat: { rests: [false, false, true], hasPropertyRest: true, hasRestElement: true },
    })
  })

  it('names literal keys by their source and computed identifiers by their name', () => {
    expect(paths('function f({ "a-b": a, 1: b, [c]: d, [c.d]: e }) {}')).toEqual(['"a-b"', '1', 'c'])
  })

  it('lists a nested pattern under a literal key without the key', () => {
    expect(paths('function f({ "a": { b } }) {}')).toEqual(['b'])
  })

  it('quotes the indexes of a top-level array pattern', () => {
    expect(paths('function f([a, b] = []) {}')).toEqual(['"0"', '"1"'])
  })

  it('reads the parameters of a method signature', () => {
    expect(parameters('interface A { m(a: string): void }')).toEqual([{ kind: 'name', name: 'a' }])
  })
})

describe('flatten', () => {
  it('lists a branch without a key under a root by the key it lacks', () => {
    expect(flatten([{ kind: 'branch', key: undefined, items: ['a'] }], 'r').names).toEqual(['r.undefined', 'r.undefined.a'])
  })
})

describe('isObjectType', () => {
  it('tells a plain object type from a named one', () => {
    expect([isObjectType('Object'), isObjectType('GenericArray'), isObjectType('Options')]).toEqual([true, true, false])
  })
})
