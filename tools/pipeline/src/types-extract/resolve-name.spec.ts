import type { ResolutionContext } from './resolve-name'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { indexOf, resolveExport, resolveName } from './resolve-name'

/**
 * A resolution context over in-memory files.
 *
 * @param files - Path to text, or null for a file known to be absent
 * @returns A context over those files with no index built yet
 */
function contextOf(files: Record<string, string | null>): ResolutionContext {
  return { files: createMap(Object.entries(files)), include: ['nx/src/'], indexes: createMap() }
}

describe('indexOf', () => {
  it('builds an index once and reuses it', () => {
    const context = contextOf({ 'nx/src/a.ts': 'export type A = 1' })
    expect(indexOf(context, 'nx/src/a.ts')).toBe(indexOf(context, 'nx/src/a.ts'))
  })

  it('throws for a file that has not been read', () => {
    expect(() => indexOf(contextOf({}), 'nx/src/a.ts')).toThrow('nx/src/a.ts has not been read')
  })
})

describe('resolveName', () => {
  it('finds a local declaration', () => {
    const context = contextOf({ 'nx/src/a.ts': 'export interface A {}' })
    expect(resolveName(context, indexOf(context, 'nx/src/a.ts'), 'A')).toEqual({ kind: 'symbol', file: 'nx/src/a.ts', name: 'A' })
  })

  it('treats an undeclared, unimported name as a global', () => {
    const context = contextOf({ 'nx/src/a.ts': 'export type A = Record<string, 1>' })
    expect(resolveName(context, indexOf(context, 'nx/src/a.ts'), 'Record')).toEqual({ kind: 'global', name: 'Record' })
  })

  it('follows an import to the declaring file', () => {
    const context = contextOf({
      'nx/src/a.ts': "import { B as Bee } from './b'\nexport type A = Bee",
      'nx/src/b.ts': 'export interface B {}',
    })
    expect(resolveName(context, indexOf(context, 'nx/src/a.ts'), 'Bee')).toEqual({ kind: 'symbol', file: 'nx/src/b.ts', name: 'B' })
  })

  it('asks for the imported module when it has not been read', () => {
    const context = contextOf({ 'nx/src/a.ts': "import { B } from './b'\nexport type A = B" })
    expect(resolveName(context, indexOf(context, 'nx/src/a.ts'), 'B')).toEqual(
      expect.objectContaining({ kind: 'pending', paths: expect.arrayContaining(['nx/src/b.ts']) })
    )
  })

  it('reports an import from a package as external', () => {
    const context = contextOf({ 'nx/src/a.ts': "import type { Mode } from 'node:fs'\nexport type A = Mode" })
    expect(resolveName(context, indexOf(context, 'nx/src/a.ts'), 'Mode')).toEqual({ kind: 'external', module: 'node:fs', name: 'Mode' })
  })

  it('reports an import from an absent module as missing', () => {
    const context = contextOf({
      'nx/src/a.ts': "import { B } from './b'\nexport type A = B",
      'nx/src/b.ts': null,
      'nx/src/b.d.ts': null,
      'nx/src/b/index.ts': null,
      'nx/src/b/index.d.ts': null,
    })
    expect(resolveName(context, indexOf(context, 'nx/src/a.ts'), 'B')).toEqual({ kind: 'missing', module: './b', name: 'B' })
  })

  it('reports a namespace import as the module', () => {
    const context = contextOf({ 'nx/src/a.ts': "import * as ns from './b'\nexport type A = ns.B", 'nx/src/b.ts': 'export interface B {}' })
    expect(resolveName(context, indexOf(context, 'nx/src/a.ts'), 'ns')).toEqual({ kind: 'namespace', file: 'nx/src/b.ts' })
  })
})

describe('resolveExport', () => {
  it('follows a re-export from another module', () => {
    const context = contextOf({ 'nx/src/a.ts': "export { B as Bee } from './b'", 'nx/src/b.ts': 'export interface B {}' })
    expect(resolveExport(context, indexOf(context, 'nx/src/a.ts'), 'Bee')).toEqual({ kind: 'symbol', file: 'nx/src/b.ts', name: 'B' })
  })

  it('follows a re-export of a local declaration under another name', () => {
    const context = contextOf({ 'nx/src/a.ts': 'interface B {}\nexport { B as Bee }' })
    expect(resolveExport(context, indexOf(context, 'nx/src/a.ts'), 'Bee')).toEqual({ kind: 'symbol', file: 'nx/src/a.ts', name: 'B' })
  })

  it('follows a re-export of an imported binding', () => {
    const context = contextOf({ 'nx/src/a.ts': "import { B } from './b'\nexport { B }", 'nx/src/b.ts': 'export interface B {}' })
    expect(resolveExport(context, indexOf(context, 'nx/src/a.ts'), 'B')).toEqual({ kind: 'symbol', file: 'nx/src/b.ts', name: 'B' })
  })

  it('reports a re-export of a name bound nowhere as missing', () => {
    const context = contextOf({ 'nx/src/a.ts': 'export { B }' })
    expect(resolveExport(context, indexOf(context, 'nx/src/a.ts'), 'B')).toEqual({ kind: 'missing', module: 'nx/src/a.ts', name: 'B' })
  })

  it('searches star exports in order and returns the first hit', () => {
    const context = contextOf({
      'nx/src/a.ts': "export * from './b'\nexport * from './c'",
      'nx/src/b.ts': 'export interface Other {}',
      'nx/src/c.ts': 'export interface C {}',
    })
    expect(resolveExport(context, indexOf(context, 'nx/src/a.ts'), 'C')).toEqual({ kind: 'symbol', file: 'nx/src/c.ts', name: 'C' })
  })

  it('reports a name no star export provides as missing', () => {
    const context = contextOf({ 'nx/src/a.ts': "export * from './b'", 'nx/src/b.ts': 'export interface Other {}' })
    expect(resolveExport(context, indexOf(context, 'nx/src/a.ts'), 'C')).toEqual({ kind: 'missing', module: 'nx/src/a.ts', name: 'C' })
  })

  it('stays pending when a star export has not been read', () => {
    const context = contextOf({ 'nx/src/a.ts': "export * from './b'" })
    expect(resolveExport(context, indexOf(context, 'nx/src/a.ts'), 'C')).toEqual(expect.objectContaining({ kind: 'pending' }))
  })

  it('stops on a re-export cycle', () => {
    const context = contextOf({ 'nx/src/a.ts': "export { C } from './b'", 'nx/src/b.ts': "export { C } from './a'" })
    expect(resolveExport(context, indexOf(context, 'nx/src/a.ts'), 'C')).toEqual({ kind: 'missing', module: 'nx/src/a.ts', name: 'C' })
  })

  it('reports a namespace re-export as the module', () => {
    const context = contextOf({ 'nx/src/a.ts': "import * as ns from './b'\nexport { ns }", 'nx/src/b.ts': 'export interface B {}' })
    expect(resolveExport(context, indexOf(context, 'nx/src/a.ts'), 'ns')).toEqual({ kind: 'namespace', file: 'nx/src/b.ts' })
  })
})
