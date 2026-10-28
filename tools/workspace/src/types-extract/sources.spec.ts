import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isRelativeSpecifier, moduleCandidates, resolveModule } from './sources'

const INCLUDE = ['nx/packages/nx/src/']

describe('isRelativeSpecifier', () => {
  it.each([
    ['./tree', true],
    ['../config/nx-json', true],
    ['typescript', false],
    ['node:fs', false],
    ['@scope/name', false],
  ])('classifies %s', (specifier, expected) => {
    expect(isRelativeSpecifier(specifier)).toBe(expected)
  })
})

describe('moduleCandidates', () => {
  it('lists the source, declaration and index files in resolution order', () => {
    expect(moduleCandidates('nx/packages/nx/src/config/misc-interfaces.ts', '../generators/tree')).toEqual([
      'nx/packages/nx/src/generators/tree.ts',
      'nx/packages/nx/src/generators/tree.d.ts',
      'nx/packages/nx/src/generators/tree/index.ts',
      'nx/packages/nx/src/generators/tree/index.d.ts',
    ])
  })

  it('drops a .js extension the specifier carries', () => {
    expect(moduleCandidates('nx/a/b.ts', './c.js')[0]).toBe('nx/a/c.ts')
  })
})

describe('resolveModule', () => {
  it('treats a package specifier as external', () => {
    expect(resolveModule(createMap(), 'nx/packages/nx/src/a.ts', 'typescript', INCLUDE)).toEqual({ kind: 'external' })
  })

  it('treats a relative module outside the followed directories as external', () => {
    expect(resolveModule(createMap(), 'nx/packages/nx/src/a.ts', '../../other/b', INCLUDE)).toEqual({ kind: 'external' })
  })

  it('asks for every candidate when none has been read', () => {
    expect(resolveModule(createMap(), 'nx/packages/nx/src/a.ts', './b', INCLUDE)).toEqual({
      kind: 'pending',
      paths: ['nx/packages/nx/src/b.ts', 'nx/packages/nx/src/b.d.ts', 'nx/packages/nx/src/b/index.ts', 'nx/packages/nx/src/b/index.d.ts'],
    })
  })

  it('resolves to the first candidate that has text', () => {
    const files = createMap<string, string | null>([['nx/packages/nx/src/b.ts', 'export type B = 1']])
    expect(resolveModule(files, 'nx/packages/nx/src/a.ts', './b', INCLUDE)).toEqual({ kind: 'file', path: 'nx/packages/nx/src/b.ts' })
  })

  it('stays pending while an earlier candidate is unread, even when a later one has text', () => {
    const files = createMap<string, string | null>([['nx/packages/nx/src/b.d.ts', 'export type B = 1']])
    expect(resolveModule(files, 'nx/packages/nx/src/a.ts', './b', INCLUDE)).toEqual({ kind: 'pending', paths: ['nx/packages/nx/src/b.ts'] })
  })

  it('skips a candidate known to be absent', () => {
    const files = createMap<string, string | null>([
      ['nx/packages/nx/src/b.ts', null],
      ['nx/packages/nx/src/b.d.ts', 'export type B = 1'],
    ])
    expect(resolveModule(files, 'nx/packages/nx/src/a.ts', './b', INCLUDE)).toEqual({ kind: 'file', path: 'nx/packages/nx/src/b.d.ts' })
  })

  it('reports a module missing when every candidate is known to be absent', () => {
    const files = createMap<string, string | null>(moduleCandidates('nx/packages/nx/src/a.ts', './b').map((path) => [path, null]))
    expect(resolveModule(files, 'nx/packages/nx/src/a.ts', './b', INCLUDE)).toEqual({ kind: 'missing' })
  })

  it('asks only for the unread candidates', () => {
    const files = createMap<string, string | null>([
      ['nx/packages/nx/src/b.ts', null],
      ['nx/packages/nx/src/b/index.ts', null],
    ])
    expect(resolveModule(files, 'nx/packages/nx/src/a.ts', './b', INCLUDE)).toEqual({
      kind: 'pending',
      paths: ['nx/packages/nx/src/b.d.ts', 'nx/packages/nx/src/b/index.d.ts'],
    })
  })
})
