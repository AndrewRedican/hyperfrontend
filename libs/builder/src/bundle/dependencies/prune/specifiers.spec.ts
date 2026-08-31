import { describe, expect, it } from '@hyperfrontend/testing'
import { collectChunkSpecifiers, hasDynamicSpecifier } from './specifiers'

describe('collectChunkSpecifiers', () => {
  it('extracts relative ESM import specifiers', () => {
    expect(collectChunkSpecifiers("import { a } from './sib/index.esm.js'")).toEqual(['./sib/index.esm.js'])
  })

  it('extracts relative ESM re-export specifiers', () => {
    expect(collectChunkSpecifiers("export { a } from '../shared/index.esm.js'")).toEqual(['../shared/index.esm.js'])
  })

  it('extracts relative CJS require specifiers', () => {
    expect(collectChunkSpecifiers("var x = require('./dep/index.cjs.js')")).toEqual(['./dep/index.cjs.js'])
  })

  it('extracts relative literal dynamic import specifiers', () => {
    expect(collectChunkSpecifiers("import('./lazy/index.esm.js')")).toEqual(['./lazy/index.esm.js'])
  })

  it('ignores bare (non-relative) specifiers', () => {
    expect(collectChunkSpecifiers("import { x } from 'rollup'")).toEqual([])
  })

  it('deduplicates repeated specifiers', () => {
    expect(collectChunkSpecifiers("import {a} from './x.js'\nimport {b} from './x.js'")).toEqual(['./x.js'])
  })

  it('returns an empty list when there are no specifiers', () => {
    expect(collectChunkSpecifiers('const noop = () => {}')).toEqual([])
  })
})

describe('hasDynamicSpecifier', () => {
  it('flags a computed require argument', () => {
    expect(hasDynamicSpecifier("require('@rollup/rollup-' + platform)")).toBe(true)
  })

  it('flags a computed dynamic import argument', () => {
    expect(hasDynamicSpecifier('import(resolvePath(name))')).toBe(true)
  })

  it('does not flag a single-quoted literal require', () => {
    expect(hasDynamicSpecifier("require('./index.cjs.js')")).toBe(false)
  })

  it('does not flag a double-quoted literal dynamic import', () => {
    expect(hasDynamicSpecifier('import("./index.esm.js")')).toBe(false)
  })

  it('flags a literal concatenated with an expression', () => {
    expect(hasDynamicSpecifier("import('./chunk-' + name + '.js')")).toBe(true)
  })

  it('does not flag a literal with surrounding whitespace before the close paren', () => {
    expect(hasDynamicSpecifier("require( './index.cjs.js' )")).toBe(false)
  })

  it('does not flag a literal containing an escaped character', () => {
    expect(hasDynamicSpecifier("require('./a\\tb/index.cjs.js')")).toBe(false)
  })

  it('flags an unterminated string argument', () => {
    expect(hasDynamicSpecifier("require('./unterminated")).toBe(true)
  })

  it('returns false when there are no import/require calls', () => {
    expect(hasDynamicSpecifier("const x = from('./not-a-call')")).toBe(false)
  })
})
