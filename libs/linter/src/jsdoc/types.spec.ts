import type { TypeNode } from './types'
import { describe, expect, it } from '@hyperfrontend/testing'
import { parseType, typeNodes } from './types'

/**
 * A type expression's tree in one line: each node's kind, value and flag, children in brackets.
 *
 * @param node - The root
 * @returns The line
 */
function shape(node: TypeNode): string {
  const own = [node.kind, node.value, node.flag].filter((part) => part !== undefined).join(':')
  const children = [node.left, node.right, node.third, node.fourth, ...(node.elements ?? [])].filter((child) => child !== undefined)
  return children.length === 0 ? own : `${own}[${children.map(shape).join(' ')}]`
}

/**
 * The shape of a parsed expression, or its error.
 *
 * @param text - The expression
 * @returns The shape line or the error message
 */
function parsed(text: string): string {
  const result = parseType(text)
  return result.node === null ? (result.error as string) : shape(result.node)
}

/** Expressions and the shapes they parse to. */
const SHAPES: readonly [string, string][] = [
  ['string', 'name:string'],
  ['  string  ', 'name:string'],
  ['*', 'any'],
  ['?', 'unknown'],
  ['?string', 'nullable[name:string]'],
  ['string?', 'nullable[name:string]'],
  ['!string', 'notNullable[name:string]'],
  ['string!', 'notNullable[name:string]'],
  ['...string', 'variadic[name:string]'],
  ['string=', 'optional[name:string]'],
  ['string[]', 'array[name:string]'],
  ['string[][]', 'array[array[name:string]]'],
  ['Array<string>', 'generic:angle[name:Array name:string]'],
  ['Array.<string, number>', 'generic:dot[name:Array name:string name:number]'],
  ['Object<string, Array<number>>', 'generic:angle[name:Object name:string generic:angle[name:Array name:number]]'],
  ['string | number', 'union[name:string name:number]'],
  ['|string|number', 'union[name:string name:number]'],
  ['A & B', 'intersection[name:A name:B]'],
  ['A & B | C', 'union[intersection[name:A name:B] name:C]'],
  ['(string | number)[]', 'array[parens[union[name:string name:number]]]'],
  ['(Number | string | Boolean)=', 'optional[parens[union[name:Number name:string name:Boolean]]]'],
  ["'once' | 'signal'", 'union[string:once string:signal]'],
  ['"quoted"', 'string:quoted'],
  ['`tpl${A}`', 'template:tpl${A}'],
  ['42', 'number:42'],
  ['-1.5', 'number:-1.5'],
  ['{a: string, b?: number}', 'object[field:a[name:string] field:b:optional[name:number]]'],
  ['{ readonly a: string; b }', 'object[field:a:readonly[name:string] field:b]'],
  ['{[key: string]: number}', 'object[index:key[name:number name:string]]'],
  ['{\n  prop: number\n  other: string\n}', 'object[field:prop[name:number] field:other[name:string]]'],
  ['{ "k": 1, 2: 3 }', 'object[field:k[number:1] field:2[number:3]]'],
  ['{ m(): void, ...rest }', 'object[field:m[function:arrow[name:void]] variadic[name:rest]]'],
  ['{}', 'object'],
  ['[number, string]', 'tuple[name:number name:string]'],
  ['[message: string, ...rest: number[]]', 'tuple[member:message[name:string] member:rest:variadic[array[name:number]]]'],
  ['[message?: string]', 'tuple[member:message:optional[name:string]]'],
  ['function(number): void', 'function:function[name:void name:number]'],
  ['function(...)', 'function:function[variadic]'],
  ['function(...string)', 'function:function[variadic[name:string]]'],
  ['? string', 'nullable[name:string]'],
  ["'a\\'b'", "string:a\\'b"],
  [
    '{ readonly m(): void, n?(): void, o() }',
    'object[field:m:readonly[function:arrow[name:void]] field:n:optional[function:arrow[name:void]] field:o[function:arrow]]',
  ],
  ['{ readonly a, b?, c }', 'object[field:a:readonly field:b:optional field:c]'],
  ['<T, U>(x: T) => U', 'function:arrow[name:U name:T name:U parameter:x[name:T]]'],
  ['new (x: number)', 'function:constructor[parameter:x[name:number]]'],
  ['function(this: X, ...rest: number[])', 'function:function[parameter:this[name:X] parameter:rest:variadic[array[name:number]]]'],
  ['(x: number, y?: string) => string', 'function:arrow[name:string parameter:x[name:number] parameter:y:optional[name:string]]'],
  ['() => string', 'function:arrow[name:string]'],
  ['new () => EntityBase', 'function:constructor[name:EntityBase]'],
  ['<T>(x: T) => T', 'function:arrow[name:T name:T parameter:x[name:T]]'],
  ['typeof bar', 'typeof[name:bar]'],
  ['keyof GlobalEventHandlersEventMap', 'keyof[name:GlobalEventHandlersEventMap]'],
  ['readonly string[]', 'readonly[array[name:string]]'],
  ["import('./foo').bar.baz", 'namePath:.[namePath:.[import[string:./foo] name:bar] name:baz]'],
  ['Parameters<testFunc>[0]', 'indexed[generic:angle[name:Parameters name:testFunc] number:0]'],
  ['typeof obj["level1"]', 'typeof[indexed[name:obj string:level1]]'],
  ['A extends B ? C : D', 'conditional[name:A name:B name:C name:D]'],
  ['x is string', 'predicate[name:x name:string]'],
  ['Store.commit', 'namePath:.[name:Store name:commit]'],
  ['module:namespace.SomeClass~inner', 'namePath:~[namePath:.[name:module:namespace name:SomeClass] name:inner]'],
  ['module:a/b', 'name:module:a/b'],
  ["module:'quoted'", 'name:module:quoted'],
  ['event:ext_anevent', 'name:event:ext_anevent'],
  ['external:Lib#member', 'namePath:#[name:external:Lib name:member]'],
  ['A#"quoted member"', 'namePath:#[name:A string:quoted member]'],
  ['Foo.event:done', 'namePath:.[name:Foo name:event:done]'],
  ['this', 'name:this'],
  ['const', 'name:const'],
  ['void ', 'name:void'],
]

/** Expressions that are no type. */
const INVALID: readonly string[] = [
  'Array<string',
  'str%ng',
  '@link SomeType',
  'Number<',
  'str(',
  '{',
  '{a: string',
  '({a: string',
  '(string|{',
  'BadType<',
  'Array<import>',
  'bar | foo<',
  'module:namespace.SomeClass<~',
  'module:namespace.SomeClass~<',
  'module:namespace.SomeClass~',
  'foo%',
  '#foo',
  'bar%',
  'Foo%#',
  '',
  '"unclosed',
  '`unclosed',
  '-',
  '{a b}',
  '[a, b',
  'A extends B ? C',
  '{[key]: number}',
  'function(',
  '(a: string) =>',
  'a.',
  'typeof',
  '1.',
]

describe('parseType', () => {
  for (const [text, expected] of SHAPES) {
    it(`parses ${JSON.stringify(text)}`, () => {
      expect(parsed(text)).toBe(expected)
    })
  }

  for (const text of INVALID) {
    it(`rejects ${JSON.stringify(text)}`, () => {
      expect(parsed(text)).toBe(`Syntax error in type: ${text}`)
    })
  }

  it('records the offsets of every node', () => {
    const node = parseType(' Array<string> ').node as TypeNode
    expect(typeNodes(node).map((each) => [each.kind, each.start, each.end])).toEqual([
      ['generic', 1, 14],
      ['name', 1, 6],
      ['name', 7, 13],
    ])
  })
})
