import { describe, expect, it } from '@hyperfrontend/testing'
import { isNodeBuiltin } from './is-node-builtin'

describe('isNodeBuiltin', () => {
  it('accepts a specifier under the node: scheme', () => {
    expect(isNodeBuiltin('node:path')).toBe(true)
  })

  it('accepts a bare core module name, subpaths included', () => {
    expect(['fs', 'fs/promises'].map(isNodeBuiltin)).toEqual([true, true])
  })

  it('rejects a package specifier', () => {
    expect(isNodeBuiltin('rollup')).toBe(false)
  })
})
