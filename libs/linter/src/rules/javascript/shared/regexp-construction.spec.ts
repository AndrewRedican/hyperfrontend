import type { Node } from '../../../code/model'
import type { ScopeAnalysis } from '../../../scope/analysis'
import { describe, expect, it } from '@hyperfrontend/testing'
import { childrenOf } from '../../../code/children'
import { parseCode } from '../../../code/parse'
import { DEFAULT_LANGUAGE } from '../../../config/model'
import { analyzeScopes } from '../../../scope/analysis'
import { constantString, isRegExpIdentifier, isRegExpReference, stringLiteralValue } from './regexp-construction'

/** A program with its analysis and the last call it makes. */
interface Analysed {
  /** The analysis. */
  readonly analysis: ScopeAnalysis
  /** The last call or construction of the program. */
  readonly call: Node
}

/**
 * Parses a module and finds its last call or construction.
 *
 * @param text - The module's text
 * @returns The analysis and the call
 */
function analyse(text: string): Analysed {
  const tree = parseCode(text, '.ts').tree as Node
  let call: Node | null = null
  const search = (node: Node): void => {
    if (node.kind === 'CallExpression' || node.kind === 'NewExpression') call = node
    for (const child of childrenOf(node)) search(child)
  }
  search(tree)
  return { analysis: analyzeScopes(tree, DEFAULT_LANGUAGE), call: call as unknown as Node }
}

/**
 * Whether the last call of a module calls the language's `RegExp`, by each test.
 *
 * @param text - The module's text
 * @returns The outright test and the tracked test
 */
function callee(text: string): readonly [boolean, boolean] {
  const { analysis, call } = analyse(text)
  return [isRegExpIdentifier(analysis, call.callee as Node), isRegExpReference(analysis, call.callee as Node)]
}

/**
 * The string the first argument of a module's last call is known to hold.
 *
 * @param text - The module's text
 * @returns The string, or null
 */
function firstArgument(text: string): string | null {
  const { analysis, call } = analyse(text)
  return constantString(analysis, (call.arguments as readonly Node[])[0] as Node)
}

describe('stringLiteralValue', () => {
  it('reads a string literal and nothing else', () => {
    const { call } = analyse("f('a', 1, `b`)")
    const [first, second, third] = call.arguments as readonly Node[]
    expect([stringLiteralValue(first), stringLiteralValue(second), stringLiteralValue(third), stringLiteralValue(undefined)]).toEqual([
      'a',
      null,
      null,
      null,
    ])
  })
})

describe('isRegExpIdentifier and isRegExpReference', () => {
  it('accept the global RegExp', () => {
    expect(callee("new RegExp('a')")).toEqual([true, true])
  })
  it('refuse a shadowed RegExp', () => {
    expect(callee("const RegExp = f; RegExp('a')")).toEqual([false, false])
  })
  it('refuse a RegExp shadowed by a parameter', () => {
    expect(callee("function g(RegExp) { return new RegExp('a') }")).toEqual([false, false])
  })
  it('track RegExp through the global object only when tracking', () => {
    expect(callee("globalThis.RegExp('a')")).toEqual([false, true])
  })
  it('refuse a member of another object, a computed member and a shadowed global object', () => {
    expect([
      callee("foo.RegExp('a')")[1],
      callee("globalThis['RegExp']('a')")[1],
      callee("const window = {}; window.RegExp('a')")[1],
    ]).toEqual([false, false, false])
  })
  it('refuse another member of the global object', () => {
    expect(callee("window.Regex('a')")[1]).toBe(false)
  })
  it('track RegExp through a constant alias only when tracking', () => {
    expect(callee("const r = RegExp; new r('a')")).toEqual([false, true])
  })
  it('refuse an alias that is not a constant, has several declarations or is destructured', () => {
    expect([
      callee("let r = RegExp; new r('a')")[1],
      callee("var r = RegExp; var r = 1; new r('a')")[1],
      callee("const { r } = { r: RegExp }; new r('a')")[1],
      callee("const r = undefined; new r('a')")[1],
    ]).toEqual([false, false, false, false])
  })
  it('refuse a constant defined by itself', () => {
    expect(callee("const r = r; new r('a')")[1]).toBe(false)
  })
  it('refuse a callee that is no identifier and no member', () => {
    expect(callee("(0, RegExp)('a')")).toEqual([false, false])
  })
})

describe('constantString', () => {
  it('reads a string literal', () => {
    expect(firstArgument("f('ab')")).toBe('ab')
  })
  it('reads a template whose substitutions are known strings', () => {
    expect([firstArgument('f(`a${"b"}c`)'), firstArgument('f(`a${x}c`)'), firstArgument('f(`plain`)')]).toEqual(['abc', null, 'plain'])
  })
  it('reads a String.raw template without substitutions', () => {
    expect([firstArgument('f(String.raw`\\1(a)`)'), firstArgument('f(String.raw`a${x}`)'), firstArgument('f(other.raw`\\1`)')]).toEqual([
      '\\1(a)',
      null,
      null,
    ])
  })
  it('refuses a String.raw whose String is shadowed or whose member is computed', () => {
    expect([
      firstArgument('const String = {}; f(String.raw`a`)'),
      firstArgument('f(String["raw"]`a`)'),
      firstArgument('f(String.cooked`a`)'),
    ]).toEqual([null, null, null])
  })
  it('concatenates two known strings and refuses other binary expressions', () => {
    expect([
      firstArgument("f('a' + 'b')"),
      firstArgument("f('a' + x)"),
      firstArgument("f(x + 'a')"),
      firstArgument("f('a' - 'b')"),
    ]).toEqual(['ab', null, null, null])
  })
  it('follows constants', () => {
    expect([firstArgument("const p = '\\\\1', s = '(a)'; f(p + s)"), firstArgument("let p = 'a'; f(p)"), firstArgument('f(x)')]).toEqual([
      '\\1(a)',
      null,
      null,
    ])
  })
  it('refuses a constant defined by itself and any other expression', () => {
    expect([firstArgument('const p = p; f(p)'), firstArgument('f(x.y)'), firstArgument('f(1)')]).toEqual([null, null, null])
  })
})
