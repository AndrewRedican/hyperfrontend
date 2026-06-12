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
    expect(requireBindingLocals(parseChunk("var a = require('x')").statements[0])).toEqual(['a'])
  })

  it('returns every name of a destructured require', () => {
    expect(requireBindingLocals(parseChunk("var { a, b } = require('x')").statements[0])).toEqual(['a', 'b'])
  })

  it('returns an empty list for a non-variable statement', () => {
    expect(requireBindingLocals(parseChunk('function f() {}').statements[0])).toEqual([])
  })

  it('skips a nested binding pattern element', () => {
    expect(requireBindingLocals(parseChunk("var { a: { b } } = require('x')").statements[0])).toEqual([])
  })

  it('skips an array-destructured require binding', () => {
    expect(requireBindingLocals(parseChunk("var [a] = require('x')").statements[0])).toEqual([])
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

describe('computeKeepClosure', () => {
  it('keeps every name of a kept multi-declarator statement', () => {
    const sourceFile = parseChunk('const a = 1, b = a;\nexport { a, b };')
    const model = analyzeChunk(sourceFile, 'esm')
    expect([...computeKeepClosure(sourceFile, model, createSet(['a', 'b']))].sort()).toEqual(['a', 'b'])
  })
})
