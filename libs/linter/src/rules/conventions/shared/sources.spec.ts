import { describe, expect, it } from '@hyperfrontend/testing'
import { compareSources, isBuiltinModule, relativeDepth, sourceCategory } from './sources'

describe('isBuiltinModule', () => {
  it('accepts a built-in by its first segment', () => {
    expect(isBuiltinModule('fs/promises')).toBe(true)
  })

  it('rejects a package', () => {
    expect(isBuiltinModule('express')).toBe(false)
  })
})

describe('sourceCategory', () => {
  it('names a prefixed built-in', () => {
    expect(sourceCategory('node:fs')).toBe('node')
  })

  it('names a bare built-in', () => {
    expect(sourceCategory('path')).toBe('node')
  })

  it('names the current directory', () => {
    expect(sourceCategory('./a')).toBe('current')
  })

  it('names a parent directory', () => {
    expect(sourceCategory('../a')).toBe('relative')
  })

  it('names a package of an internal scope', () => {
    expect(sourceCategory('@acme/a', ['@acme'])).toBe('internal')
  })

  it('names a scoped package external when its scope is not internal', () => {
    expect(sourceCategory('@acme/a')).toBe('external')
  })

  it('names an external package', () => {
    expect(sourceCategory('@scope/a')).toBe('external')
  })
})

describe('relativeDepth', () => {
  it('counts the leading climbs', () => {
    expect(relativeDepth('../../a/../b')).toBe(2)
  })
})

describe('compareSources', () => {
  it('orders by category', () => {
    expect(compareSources('./a', 'node:fs') > 0).toBe(true)
  })

  it('orders deeper relative sources first', () => {
    expect(compareSources('../../a', '../b') < 0).toBe(true)
  })

  it('orders alphabetically within a category', () => {
    expect(compareSources('../b', '../a') > 0).toBe(true)
  })
})
