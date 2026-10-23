import type { Node } from '../../../code/model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { childrenOf } from '../../../code/children'
import { parseCode } from '../../../code/parse'
import { returnsOnEveryPath, returnsValue } from './returns'

/** The kinds of node a case's function may be. */
const KINDS = ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'TSDeclareFunction']

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

describe('returnsValue', () => {
  it('finds a return in a try block', () => {
    expect(returnsValue(firstFunction('function f() { try { return 1 } catch {} }'))).toBe(true)
  })

  it('finds a return in a catch clause', () => {
    expect(returnsValue(firstFunction('function f() { try {} catch (e) { return 1 } }'))).toBe(true)
  })

  it('finds a return in a finally block', () => {
    expect(returnsValue(firstFunction('function f() { try {} finally { return 1 } }'))).toBe(true)
  })

  it('finds none in a try without handler or finaliser value', () => {
    expect(returnsValue(firstFunction('function f() { try {} finally {} }'))).toBe(false)
  })

  it('finds a return in an else branch', () => {
    expect(returnsValue(firstFunction('function f(a) { if (a) {} else return 1 }'))).toBe(true)
  })

  it('finds a return in a switch case', () => {
    expect(returnsValue(firstFunction('function f(a) { switch (a) { case 1: return 1 } }'))).toBe(true)
  })

  it('reads a declared signature without a return type as returning nothing', () => {
    expect(returnsValue(firstFunction('declare function f()'))).toBe(false)
  })

  it('reads a declared signature returning never as returning nothing', () => {
    expect(returnsValue(firstFunction('declare function f(): never'))).toBe(false)
  })

  it('reads a promise whose executor destructures its parameters as resolving nothing', () => {
    expect(returnsValue(firstFunction('function f() { return new Promise(({ a }) => a(1)) }'))).toBe(false)
  })

  it('reads a promise without an executor as resolving nothing', () => {
    expect(returnsValue(firstFunction('function f() { return new Promise() }'))).toBe(false)
  })

  it('reads a call of another promise class as a value', () => {
    expect(returnsValue(firstFunction('function f() { return new Other(r => r()) }'))).toBe(true)
  })

  it('reads a promise of void from an expression body as returning nothing', () => {
    expect(returnsValue(firstFunction('const f = () => new Promise<void>(r => r())'))).toBe(false)
  })

  it('reads a resolver called through a member as resolving nothing', () => {
    expect(returnsValue(firstFunction('function f() { return new Promise(r => a.r(1)) }'))).toBe(false)
  })
  it('finds a resolver called in a nested callback', () => {
    expect(returnsValue(firstFunction('function f() { return new Promise(r => { g(() => r(1)) }) }'))).toBe(true)
  })

  it('passes over a callback shadowing the resolver', () => {
    expect(returnsValue(firstFunction('function f() { return new Promise(r => { g((r) => r(1)) }) }'))).toBe(false)
  })

  it('finds a resolver passed on to a call', () => {
    expect(returnsValue(firstFunction('function f() { return new Promise(r => g(r)) }'))).toBe(true)
  })

  it('reads an empty return as returning nothing', () => {
    expect(returnsValue(firstFunction('function f() { return }'))).toBe(false)
  })

  it('reads an expression body as a value', () => {
    expect(returnsValue(firstFunction('const f = () => 1'))).toBe(true)
  })

  it('reads a promise of a value from an expression body as a value', () => {
    expect(returnsValue(firstFunction('const f = () => new Promise<string>(r => r())'))).toBe(true)
  })
  it('reads a returned promise of void as returning nothing', () => {
    expect(returnsValue(firstFunction('function f() { return new Promise<void>(r => r(1)) }'))).toBe(false)
  })

  it('finds a return in a loop body', () => {
    expect(returnsValue(firstFunction('function f(a) { while (a) return 1 }'))).toBe(true)
  })
})

describe('returnsOnEveryPath', () => {
  it('reads a declared signature by its return type', () => {
    expect(returnsOnEveryPath(firstFunction('declare function f(): string'), false)).toBe(true)
  })

  it('reads an expression body as a value on every path', () => {
    expect(returnsOnEveryPath(firstFunction('const f = () => 1'), false)).toBe(true)
  })

  it('finds no value in an empty function', () => {
    expect(returnsOnEveryPath(firstFunction('function f() {}'), false)).toBe(false)
  })

  it('stops at an empty return met before a value', () => {
    expect(returnsOnEveryPath(firstFunction('function f(a) { if (a) return; return 1 }'), false)).toBe(false)
  })

  it('reads a block by its last statement', () => {
    expect(returnsOnEveryPath(firstFunction('function f() { g(); return 1 }'), false)).toBe(true)
  })

  it('reads an empty branch as returning nothing', () => {
    expect(returnsOnEveryPath(firstFunction('function f(a) { if (a) { return 1 } else {} }'), false)).toBe(false)
  })

  it('reads an endless while loop by any return in it', () => {
    expect(returnsOnEveryPath(firstFunction('function f(a) { while (true) { if (a) return 1 } }'), false)).toBe(true)
  })

  it('reads an endless for loop by any return in it', () => {
    expect(returnsOnEveryPath(firstFunction('function f(a) { for (;;) { if (a) return 1 } }'), false)).toBe(true)
  })

  it('reads a bounded for loop by its body', () => {
    expect(returnsOnEveryPath(firstFunction('function f(a) { for (;true;) { if (a) return 1 } }'), false)).toBe(false)
  })

  it('reads a conditional while loop by its body', () => {
    expect(returnsOnEveryPath(firstFunction('function f(x) { while (x) { return 1 } }'), false)).toBe(true)
  })

  it('reads a for-of loop by its body', () => {
    expect(returnsOnEveryPath(firstFunction('function f(x) { for (const a of x) { return 1 } }'), false)).toBe(true)
  })

  it('reads an if without else as a path without a value', () => {
    expect(returnsOnEveryPath(firstFunction('function f(a) { if (a) return 1 }'), false)).toBe(false)
  })

  it('reads a switch whose cases all return', () => {
    expect(returnsOnEveryPath(firstFunction('function f(a) { switch (a) { case 1: return 1; default: return 2 } }'), false)).toBe(true)
  })

  it('reads a switch case returning empty as a path without a value', () => {
    expect(returnsOnEveryPath(firstFunction('function f(a) { switch (a) { case 1: return 1; case 2: return } }'), false)).toBe(false)
  })

  it('reads a switch case breaking as a path without a value', () => {
    expect(returnsOnEveryPath(firstFunction('function f(a) { switch (a) { case 1: return 1; break } }'), false)).toBe(false)
  })

  it('reads a throw as an end of its path', () => {
    expect(returnsOnEveryPath(firstFunction('function f(a) { if (a) return 1; throw a }'), false)).toBe(true)
  })

  it('reads a try by a finally that returns', () => {
    expect(returnsOnEveryPath(firstFunction('function f() { try { g() } finally { return 1 } }'), false)).toBe(true)
  })

  it('reads a try by its block and handler', () => {
    expect(returnsOnEveryPath(firstFunction('function f() { try { return 1 } catch { return 2 } }'), false)).toBe(true)
  })

  it('reads a try by its block and a finally without empty return', () => {
    expect(returnsOnEveryPath(firstFunction('function f() { try { return 1 } finally { g() } }'), false)).toBe(true)
  })

  it('reads a try whose finally returns empty as a path without a value', () => {
    expect(returnsOnEveryPath(firstFunction('function f(a) { try { return 1 } finally { if (a) return } }'), false)).toBe(false)
  })

  it('reads a try whose block does not return as a path without a value', () => {
    expect(returnsOnEveryPath(firstFunction('function f() { try { g() } catch { return 1 } }'), false)).toBe(false)
  })

  it('reads a trailing expression as a path without a value', () => {
    expect(returnsOnEveryPath(firstFunction('function f(a) { if (a) return 1; g() }'), false)).toBe(false)
  })

  it('reads a labelled block by its body', () => {
    expect(returnsOnEveryPath(firstFunction('function f() { a: { return 1 } }'), false)).toBe(true)
  })

  it('counts a returned promise when any promise counts', () => {
    expect(returnsOnEveryPath(firstFunction('function f() { return new Promise(r => r()) }'), true)).toBe(true)
  })

  it('reads a for-in loop by its body', () => {
    expect(returnsOnEveryPath(firstFunction('function f(x) { for (const a in x) { return 1 } }'), false)).toBe(true)
  })
})
