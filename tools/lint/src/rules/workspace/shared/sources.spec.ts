import type { Node } from '@hyperfrontend/linter'
import { describe, expect, it } from '@hyperfrontend/testing'
import { compareModuleStatements, compareSources, isBuiltinModule, isTypeOnly, relativeDepth, sourceCategory, sourceOf } from './sources.ts'

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

  it('names the workspace scope', () => {
    expect(sourceCategory('@hyperfrontend/a')).toBe('workspace')
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

/**
 * An import or re-export statement as the ordering reads it.
 *
 * @param source - The module specifier
 * @param kind - `type` for a type-only statement
 * @param field - Whether the statement is an import or an export
 * @returns A node with the fields the helpers read
 */
const statement = (source: string, kind: 'type' | 'value' = 'value', field: 'importKind' | 'exportKind' = 'importKind'): Node =>
  ({
    kind: 'ImportDeclaration',
    start: 0,
    end: 0,
    [field]: kind,
    source: { kind: 'Literal', start: 0, end: 0, value: source },
  }) as unknown as Node

describe('compareModuleStatements', () => {
  it('puts a type-only statement first', () => {
    expect(compareModuleStatements(statement('./a'), statement('node:fs', 'type')) > 0).toBe(true)
  })

  it('puts a value statement after a type-only one', () => {
    expect(compareModuleStatements(statement('node:fs', 'type'), statement('./a')) < 0).toBe(true)
  })

  it('orders statements of one kind by source', () => {
    expect(compareModuleStatements(statement('@hyperfrontend/a'), statement('lodash')) > 0).toBe(true)
  })
})

describe('isTypeOnly', () => {
  it('recognises a type-only re-export', () => {
    expect(isTypeOnly(statement('./a', 'type', 'exportKind'))).toBe(true)
  })
})

describe('sourceOf', () => {
  it('reads the module specifier', () => {
    expect(sourceOf(statement('./a'))).toBe('./a')
  })
})
