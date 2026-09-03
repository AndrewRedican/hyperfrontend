import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { describe, expect, it } from '@hyperfrontend/testing'
import { parseChunk } from './ast-utils'
import { collectFreeRefs } from './free-refs'

const refsOf = (source: string): string[] => {
  const refs = createSet<string>([])
  for (const statement of parseChunk(source).statements) collectFreeRefs(statement, refs)
  return from(refs).sort()
}

describe('collectFreeRefs', () => {
  it('reports a free name but not the function parameters', () => {
    expect(refsOf('function f(data) { return data + g }')).toEqual(['g'])
  })

  it('excludes arrow parameters and the declaration name itself', () => {
    expect(refsOf('const cb = (key, value) => key + value + outer;')).toEqual(['outer'])
  })

  it('tracks shadowing through nested arrows', () => {
    expect(refsOf('const x = (a) => (b) => a + b + c;')).toEqual(['c'])
  })

  it('binds destructured parameters while keeping their defaults free', () => {
    expect(refsOf('function f({ a, b: [c] = arr }) { return a + c + d }')).toEqual(['arr', 'd'])
  })

  it('hoists var declarations out of nested blocks', () => {
    expect(refsOf('function f() { { var v = 1; } return v + w }')).toEqual(['w'])
  })

  it('keeps a let binding scoped to its block', () => {
    expect(refsOf('function f() { { let l = 1; } return l }')).toEqual(['l'])
  })

  it('binds the catch clause parameter', () => {
    expect(refsOf('function f() { try { g() } catch (err) { return err } }')).toEqual(['g'])
  })

  it('walks a parameterless catch clause without bindings', () => {
    expect(refsOf('function f() { try { g() } catch { h() } }')).toEqual(['g', 'h'])
  })

  it('binds a for-of loop variable', () => {
    expect(refsOf('function f(xs) { for (const x of xs) use(x) }')).toEqual(['use'])
  })

  it('binds a for-in loop variable', () => {
    expect(refsOf('function f(obj) { for (const k in obj) use(k) }')).toEqual(['use'])
  })

  it('hoists a var for-initializer to the function scope', () => {
    expect(refsOf('function f() { for (var i = 0; i < n; i += 1) {} return i }')).toEqual(['n'])
  })

  it('scopes a let for-initializer to the loop', () => {
    expect(refsOf('function f() { for (let i = 0; i < n; i += 1) body(i) }')).toEqual(['body', 'n'])
  })

  it('reports an assignment-expression for-initializer as free', () => {
    expect(refsOf('function f() { for (i = 0; i < 2; i += 1) {} }')).toEqual(['i'])
  })

  it('binds class members and reports their free references', () => {
    expect(refsOf('class C { m(p) { return p + q } n = r + s }')).toEqual(['q', 'r', 's'])
  })

  it('binds the class name inside its own body', () => {
    expect(refsOf('class C { m() { return C } }')).toEqual([])
  })

  it('binds a class expression name inside its body', () => {
    expect(refsOf('const K = class Inner { m() { return Inner } };')).toEqual([])
  })

  it('reports a reference to an unnamed class expression binding as free', () => {
    expect(refsOf('const C = class { m() { return C } };')).toEqual(['C'])
  })

  it('binds a recursive function declaration name', () => {
    expect(refsOf('function fact(n) { return n * fact(n) }')).toEqual([])
  })

  it('binds a function expression name inside itself', () => {
    expect(refsOf('const f = function self() { return self };')).toEqual([])
  })

  it('binds arguments inside a function but not inside an arrow', () => {
    expect(refsOf('function f() { return arguments.length + g }\nconst a = () => arguments;')).toEqual(['arguments', 'g'])
  })

  it('ignores statement labels', () => {
    expect(refsOf('function f() { loop: for (;;) { if (x) continue loop; break loop } }')).toEqual(['x'])
  })

  it('treats a shorthand property as a reference', () => {
    expect(refsOf('const o = { inject };')).toEqual(['inject'])
  })

  it('skips member and property key names', () => {
    expect(refsOf('const o = a.b.c;\nconst p = { k: 1 };')).toEqual(['a'])
  })

  it('treats a computed property key as a reference', () => {
    expect(refsOf('const o = { [key]: 1 };')).toEqual(['key'])
  })

  it('binds accessor parameters in object literals', () => {
    expect(refsOf('const o = { get g() { return gv }, set s(v) { sv = v } };')).toEqual(['gv', 'sv'])
  })

  it('binds destructuring patterns with holes and reports the source as free', () => {
    expect(refsOf('const [, second] = pair;')).toEqual(['pair'])
  })

  it('scopes case-clause lexical declarations to the switch block', () => {
    expect(refsOf('function f(x) { switch (x) { case 1: break; default: const d = 1; return d + e } }')).toEqual(['e'])
  })

  it('hoists vars inside a class static block to that block only', () => {
    expect(refsOf('class C { static { var sv = init(); use(sv) } }')).toEqual(['init', 'use'])
  })

  it('reports only genuinely free names from deeply nested expressions', () => {
    expect(refsOf('const x = () => { if (cond) { return helper(v) } };')).toEqual(['cond', 'helper', 'v'])
  })

  it('never reports callback parameters that shadow owned module names', () => {
    const source = [
      'function isValidMessage(message) {',
      '  const callback = (key, value, path, state) => { state.valid = isValid(value) }',
      '  traverse(message, callback)',
      '  return getType(message)',
      '}',
    ].join('\n')
    expect(refsOf(source)).toEqual(['getType', 'isValid', 'traverse'])
  })

  it('skips import.meta member accesses', () => {
    expect(refsOf('const dir = import.meta.dirname;')).toEqual([])
  })
})
