import type ts from 'typescript'
import { describe, expect, it } from '@hyperfrontend/testing'
import { getRequireSpecifier, parseChunk, resolveRelativeTarget } from './ast-utils'

const firstExpression = (source: string): ts.Node => {
  const statement = parseChunk(source).statements[0]
  return (statement as ts.ExpressionStatement).expression
}

describe('parseChunk', () => {
  it('parses source into a source file with the expected top-level statement count', () => {
    expect(parseChunk('const a = 1\nconst b = 2').statements).toHaveLength(2)
  })
})

describe('resolveRelativeTarget', () => {
  it('joins a relative specifier against the importer directory', () => {
    expect(resolveRelativeTarget('/dist/libs/foo/_dependencies/a', '../b/index.esm.js')).toBe('/dist/libs/foo/_dependencies/b/index.esm.js')
  })

  it('returns null for a non-relative specifier', () => {
    expect(resolveRelativeTarget('/dist/libs/foo', 'rollup')).toBeNull()
  })
})

describe('getRequireSpecifier', () => {
  it('returns the specifier of a literal require call', () => {
    expect(getRequireSpecifier(firstExpression("require('./dep/index.cjs.js')"))).toBe('./dep/index.cjs.js')
  })

  it('returns null when the node is not a call expression', () => {
    expect(getRequireSpecifier(firstExpression('42'))).toBeNull()
  })

  it('returns null when the callee is not the require identifier', () => {
    expect(getRequireSpecifier(firstExpression("foo('./x.js')"))).toBeNull()
  })

  it('returns null when the callee is a property access rather than an identifier', () => {
    expect(getRequireSpecifier(firstExpression("mod.require('./x.js')"))).toBeNull()
  })

  it('returns null when require is called with no arguments', () => {
    expect(getRequireSpecifier(firstExpression('require()'))).toBeNull()
  })

  it('returns null when require is called with more than one argument', () => {
    expect(getRequireSpecifier(firstExpression("require('./a.js', './b.js')"))).toBeNull()
  })

  it('returns null when the require argument is not a string literal', () => {
    expect(getRequireSpecifier(firstExpression('require(name)'))).toBeNull()
  })
})
