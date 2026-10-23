import type { Node } from '../../../code/model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { childrenOf } from '../../../code/children'
import { parseCode } from '../../../code/parse'
import { yieldsValue } from './yields'

/** The kinds of node a case's function may be. */
const KINDS = ['FunctionDeclaration', 'FunctionExpression', 'TSDeclareFunction']

/**
 * The first function of a text, in a walk from the program down.
 *
 * @param text - The code parsed
 * @returns The first function node found
 */
function firstFunction(text: string): Node {
  const pending = [parseCode(text, '.ts').tree as Node]
  for (;;) {
    const node = pending.shift() as Node
    if (KINDS.includes(node.kind)) return node
    pending.push(...childrenOf(node))
  }
}

describe('yieldsValue', () => {
  it('finds a yield with a value in an expression', () => {
    expect(yieldsValue(firstFunction('function * f() { a(yield 1) }'))).toBe(true)
  })

  it('reads an empty yield as yielding nothing', () => {
    expect(yieldsValue(firstFunction('function * f() { yield }'))).toBe(false)
  })

  it('passes over the yields of a nested generator', () => {
    expect(yieldsValue(firstFunction('function * f() { const g = function * () { yield 1 } }'))).toBe(false)
  })

  it('reads a declared signature as yielding nothing', () => {
    expect(yieldsValue(firstFunction('declare function f(): Generator<number>'))).toBe(false)
  })
})
