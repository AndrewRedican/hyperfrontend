import type { Statement } from 'typescript'
import type { ChunkFormat } from './used-exports'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { parseChunk } from './ast-utils'
import { analyzeChunk, collectRefs, computeKeepClosure, requireBindingLocals } from './chunk-graph'

const refs = (source: string): string[] => {
  const sink = createSet<string>([])
  for (const statement of parseChunk(source).statements) collectRefs(statement, sink)
  return [...sink].sort()
}

describe('collectRefs', () => {
  it('collects plain identifier references', () => {
    expect(refs('foo(bar)')).toEqual(['bar', 'foo'])
  })

  it('skips the member name of a property access', () => {
    expect(refs('a.b')).toEqual(['a'])
  })

  it('skips an object-literal property key', () => {
    expect(refs('const o = { k: v }')).toEqual(['o', 'v'])
  })

  it('skips a binding-element property name', () => {
    expect(refs('const { k: v } = src')).toEqual(['src', 'v'])
  })
})

describe('requireBindingLocals', () => {
  it('returns the identifier binding of a namespace require', () => {
    expect(requireBindingLocals(<Statement>parseChunk("var a = require('x')").statements[0])).toEqual(['a'])
  })

  it('returns every name of a destructured require', () => {
    expect(requireBindingLocals(<Statement>parseChunk("var { a, b } = require('x')").statements[0])).toEqual(['a', 'b'])
  })

  it('returns an empty list for a non-variable statement', () => {
    expect(requireBindingLocals(<Statement>parseChunk('function f() {}').statements[0])).toEqual([])
  })

  it('skips a nested binding pattern element', () => {
    expect(requireBindingLocals(<Statement>parseChunk("var { a: { b } } = require('x')").statements[0])).toEqual([])
  })

  it('skips an array-destructured require binding', () => {
    expect(requireBindingLocals(<Statement>parseChunk("var [a] = require('x')").statements[0])).toEqual([])
  })
})

const exportsOf = (source: string, format: ChunkFormat): string[] =>
  analyzeChunk(parseChunk(source), format).exports.map((entry) => `${entry.exported}<-${entry.local}`)

describe('analyzeChunk export surface', () => {
  it('excludes a re-export carrying a module specifier', () => {
    expect(exportsOf("export { a } from './x.js'", 'esm')).toEqual([])
  })

  it('excludes a default export', () => {
    expect(exportsOf('const a = 1;\nexport default a;', 'esm')).toEqual([])
  })

  it('records an inline-exported function', () => {
    expect(exportsOf('export function f() {}', 'esm')).toEqual(['f<-f'])
  })

  it('records an aliased entry in an export list', () => {
    expect(exportsOf('const a = 1;\nexport { a as b };', 'esm')).toEqual(['b<-a'])
  })

  it('ignores a non-assignment expression statement', () => {
    expect(exportsOf("Object.defineProperty(exports, 'a', {});", 'cjs')).toEqual([])
  })

  it('ignores a non-equals binary expression', () => {
    expect(exportsOf('exports.a == a;', 'cjs')).toEqual([])
  })

  it('ignores an assignment whose target object is not exports', () => {
    expect(exportsOf('foo.a = a;', 'cjs')).toEqual([])
  })

  it('ignores an assignment whose right side is not an identifier', () => {
    expect(exportsOf('exports.a = 1;', 'cjs')).toEqual([])
  })

  it('ignores an element-access assignment on exports', () => {
    expect(exportsOf("exports['a'] = a;", 'cjs')).toEqual([])
  })

  it('records a plain exports assignment', () => {
    expect(exportsOf('exports.a = b;', 'cjs')).toEqual(['a<-b'])
  })

  it('excludes an inline-exported destructuring declaration', () => {
    expect(exportsOf('export const { a } = obj;', 'esm')).toEqual([])
  })
})

const freeOf = (source: string, name: string): boolean => {
  const decl = analyzeChunk(parseChunk(source), 'esm').nameToDecl.get(name)
  if (!decl) throw new Error(`no declaration for ${name}`)
  return decl.sideEffectFree
}

describe('analyzeChunk pure-freeze recognition', () => {
  it('treats an aliased freeze of a fresh object literal as side-effect-free', () => {
    expect(freeOf('const _freeze = globalThis.Object.freeze;\nconst X = _freeze({ a: fn });', 'X')).toBe(true)
  })

  it('treats a direct unaliased Object.freeze of a fresh object literal as side-effect-free', () => {
    expect(freeOf('const X = Object.freeze({ a: fn });', 'X')).toBe(true)
  })

  it('treats a direct globalThis.Object.freeze as side-effect-free', () => {
    expect(freeOf('const X = globalThis.Object.freeze({ a: fn });', 'X')).toBe(true)
  })

  it('treats a freeze of a fresh array literal as side-effect-free', () => {
    expect(freeOf('const _freeze = globalThis.Object.freeze;\nconst X = _freeze([a, b]);', 'X')).toBe(true)
  })

  it('treats a freeze of a shared identifier binding as side-effecting', () => {
    expect(freeOf('const _freeze = globalThis.Object.freeze;\nconst X = _freeze(shared);', 'X')).toBe(false)
  })

  it('keeps a freeze of an object literal spreading an identifier side-effect-free', () => {
    expect(freeOf('const _freeze = globalThis.Object.freeze;\nconst X = _freeze({ ...spread });', 'X')).toBe(true)
  })

  it('descends into freeze arguments so a nested call trips the side-effect check', () => {
    expect(freeOf('const _freeze = globalThis.Object.freeze;\nconst X = _freeze({ x: mk() });', 'X')).toBe(false)
  })

  it('treats a freeze with no arguments as side-effecting', () => {
    expect(freeOf('const _freeze = globalThis.Object.freeze;\nconst X = _freeze();', 'X')).toBe(false)
  })

  it('treats a non-pure callee over a fresh literal as side-effecting', () => {
    expect(freeOf('const X = register({ a: fn });', 'X')).toBe(false)
  })

  it('does not add an alias bound to a call to the pure set', () => {
    const source = 'const f = mk();\nconst Y = f({ a: 1 });'
    expect(freeOf(source, 'f')).toBe(false)
    expect(freeOf(source, 'Y')).toBe(false)
  })

  it('drops the direct Object.freeze seed when Object is shadowed by a top-level binding', () => {
    expect(freeOf('const Object = {};\nconst X = Object.freeze({ a: 1 });', 'X')).toBe(false)
  })

  it('drops the direct Object.freeze seed when Object is shadowed by a function declaration', () => {
    expect(freeOf('function Object() {}\nconst X = Object.freeze({ a: 1 });', 'X')).toBe(false)
  })

  it('follows a const-aliased alias of a freeze to its canonical callee', () => {
    expect(freeOf('const _freeze = globalThis.Object.freeze;\nconst ff = _freeze;\nconst X = ff({ a: 1 });', 'X')).toBe(true)
  })

  it('treats an alias-of-global freeze (`_Object.freeze`) of a fresh object literal as side-effect-free', () => {
    expect(freeOf('const _Object = globalThis.Object;\nconst X = _Object.freeze({ a: fn });', 'X')).toBe(true)
  })

  it('treats a bare-global alias seal of a fresh object literal as side-effect-free', () => {
    expect(freeOf('const _Object = Object;\nconst X = _Object.seal({ a: 1 });', 'X')).toBe(true)
  })

  it('treats an alias-of-global preventExtensions of a fresh array literal as side-effect-free', () => {
    expect(freeOf('const _Object = globalThis.Object;\nconst X = _Object.preventExtensions([a]);', 'X')).toBe(true)
  })

  it('treats an alias-of-global freeze of a shared identifier binding as side-effecting', () => {
    expect(freeOf('const _Object = globalThis.Object;\nconst X = _Object.freeze(shared);', 'X')).toBe(false)
  })

  it('treats a call whose callee is neither an identifier nor a property access as side-effecting', () => {
    expect(freeOf('const X = handlers[0]({ a: 1 });', 'X')).toBe(false)
  })

  it('treats a call whose callee chain is rooted in a non-identifier base as side-effecting', () => {
    expect(freeOf('const X = handlers[0].freeze({ a: 1 });', 'X')).toBe(false)
  })
})

describe('analyzeChunk @__PURE__ annotation recognition', () => {
  it('treats an @__PURE__-annotated call of an opaque callee as side-effect-free', () => {
    expect(freeOf('const X = /*@__PURE__*/ register({ a: 1 });', 'X')).toBe(true)
  })

  it('honors the #__PURE__ spelling', () => {
    expect(freeOf('const X = /*#__PURE__*/ register({ a: 1 });', 'X')).toBe(true)
  })

  it('treats an @__PURE__-annotated new expression as side-effect-free', () => {
    expect(freeOf('const X = /*@__PURE__*/ new Thing(1);', 'X')).toBe(true)
  })

  it('still trips on a side-effecting argument of an annotated call', () => {
    expect(freeOf('const X = /*@__PURE__*/ register({ a: mk() });', 'X')).toBe(false)
  })

  it('ignores a leading comment that is not a purity annotation', () => {
    expect(freeOf('const X = /* keep me */ register({ a: 1 });', 'X')).toBe(false)
  })

  it('treats an unannotated new expression as side-effecting', () => {
    expect(freeOf('const X = new Thing(1);', 'X')).toBe(false)
  })
})

const errorChunk = `const _freeze = globalThis.Object.freeze;
const _TypeError = globalThis.TypeError;
const _RangeError = globalThis.RangeError;
const createError = (msg) => new _TypeError(msg);
const createRangeError = (msg) => new _RangeError(msg);
const Error = _freeze({ createError, createRangeError });
export { createError, createRangeError, Error };`

describe('computeKeepClosure', () => {
  it('keeps every name of a kept multi-declarator statement', () => {
    const sourceFile = parseChunk('const a = 1, b = a;\nexport { a, b };')
    const model = analyzeChunk(sourceFile, 'esm')
    expect([...computeKeepClosure(sourceFile, model, createSet(['a', 'b']))].sort()).toEqual(['a', 'b'])
  })

  it('drops a dead frozen namespace and the factories and captures it names', () => {
    const sourceFile = parseChunk(errorChunk)
    const model = analyzeChunk(sourceFile, 'esm')
    expect([...computeKeepClosure(sourceFile, model, createSet<string>([]))]).toEqual([])
  })

  it('cascades a single-factory demand without dragging in the namespace or its siblings', () => {
    const sourceFile = parseChunk(errorChunk)
    const model = analyzeChunk(sourceFile, 'esm')
    const closure = computeKeepClosure(sourceFile, model, createSet(['createError']))
    expect(closure.has('createError')).toBe(true)
    expect(closure.has('_TypeError')).toBe(true)
    expect(closure.has('Error')).toBe(false)
    expect(closure.has('createRangeError')).toBe(false)
    expect(closure.has('_RangeError')).toBe(false)
  })
})
