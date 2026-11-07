import type { BoundaryConfig, RequestConfig } from './config'
import type { ResolutionContext } from './resolve-name'
import type { ReferenceTarget, WalkResult } from './walk'
import { posix } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isNodeBuiltin, walk } from './walk'

const BOUNDARY: BoundaryConfig = { default: 'unknown', overrides: { Heavy: 'object' } }

/**
 * Walks requests over in-memory files.
 *
 * @param files - Path to text, or null for a file known to be absent; paths are relative to the source `nx`
 * @param requests - The requests, without their source
 * @returns The result
 */
function walkOver(files: Record<string, string | null>, requests: Omit<RequestConfig, 'source'>[]): WalkResult {
  const context: ResolutionContext = {
    files: createMap(Object.entries(files).map(([path, text]) => [posix.join('nx', path), text])),
    include: ['nx/src/'],
    indexes: createMap(),
  }
  return walk(
    requests.map((request) => ({ ...request, source: 'nx' })),
    BOUNDARY,
    context
  )
}

/**
 * The targets of every reference of a symbol, summarised.
 *
 * @param result - The walk
 * @param key - The symbol's key
 * @returns Reference name to target
 */
function targetsOf(result: WalkResult, key: string): [string, ReferenceTarget][] {
  return (result.symbols.get(key)?.declarations ?? []).flatMap((declaration) =>
    declaration.references.map((reference): [string, ReferenceTarget] => [reference.reference.name, reference.target])
  )
}

const ROOT = { root: 'src/root.ts', symbols: ['Root'], depth: 2, output: 'out/root.ts' }

describe('isNodeBuiltin', () => {
  it.each([
    ['node:fs', true],
    ['fs', true],
    ['path', true],
    ['typescript', false],
    ['./local', false],
  ])('classifies %s', (module, expected) => {
    expect(isNodeBuiltin(module)).toBe(expected)
  })
})

describe('walk', () => {
  it('asks for the root module before anything else', () => {
    expect(walkOver({}, [ROOT]).pending).toEqual(['nx/src/root.ts'])
  })

  it('asks for the modules the root imports', () => {
    const result = walkOver({ 'src/root.ts': "import { A } from './a'\nexport interface Root { a: A }" }, [ROOT])
    expect(result.pending).toEqual(['nx/src/a.d.ts', 'nx/src/a.ts', 'nx/src/a/index.d.ts', 'nx/src/a/index.ts'])
  })

  it('asks for the module a root re-export points at', () => {
    expect(walkOver({ 'src/root.ts': "export { Root } from './a'" }, [ROOT]).pending).toEqual(expect.arrayContaining(['nx/src/a.ts']))
  })

  it('throws when the root module does not exist', () => {
    expect(() => walkOver({ 'src/root.ts': null }, [ROOT])).toThrow('nx: the root module src/root.ts does not exist')
  })

  it('throws when the root module does not export a root', () => {
    expect(() => walkOver({ 'src/root.ts': 'export interface Other {}' }, [ROOT])).toThrow('nx: src/root.ts does not export Root')
  })

  it('throws when a root is a value', () => {
    expect(() => walkOver({ 'src/root.ts': 'export const Root = 1' }, [ROOT])).toThrow('nx: Root in src/root.ts is not a type')
  })

  it('places the root and what it reaches within the depth, in reach order', () => {
    const files = {
      'src/root.ts':
        "import { A } from './a'\nexport interface Root { a: A; b: B }\ninterface B { c: C }\ninterface C { d: D }\ninterface D {}",
      'src/a.ts': 'export type A = string',
    }
    const result = walkOver(files, [ROOT])
    expect([...result.placements.entries()]).toEqual([
      ['nx/src/root.ts#Root', 'out/root.ts'],
      ['nx/src/a.ts#A', 'out/root.ts'],
      ['nx/src/root.ts#B', 'out/root.ts'],
      ['nx/src/root.ts#C', 'out/root.ts'],
    ])
  })

  it('keeps the shallowest depth for a symbol reached twice', () => {
    const files = { 'src/root.ts': 'export interface Root { a: A; b: B }\ninterface A { b: B }\ninterface B { c: C }\ninterface C {}' }
    const result = walkOver(files, [{ ...ROOT, depth: 1 }])
    expect([...result.placements.keys()]).toEqual(['nx/src/root.ts#Root', 'nx/src/root.ts#A', 'nx/src/root.ts#B'])
  })

  it('resolves references through imports, re-exports and globals', () => {
    const files = {
      'src/root.ts':
        "import { A } from './barrel'\nimport type { Mode } from 'node:fs'\nexport interface Root { a: A; m: Mode; r: Record<string, 1>; local: Local }\ninterface Local {}",
      'src/barrel.ts': "export { A } from './a'",
      'src/a.ts': 'export interface A {}',
    }
    const result = walkOver(files, [ROOT])
    expect(targetsOf(result, 'nx/src/root.ts#Root')).toEqual([
      ['A', { kind: 'symbol', key: 'nx/src/a.ts#A' }],
      ['Mode', { kind: 'external', module: 'node:fs', name: 'Mode' }],
      ['Record', { kind: 'global' }],
      ['Local', { kind: 'symbol', key: 'nx/src/root.ts#Local' }],
    ])
  })

  it('normalises a bare built-in module to its node: form', () => {
    const files = { 'src/root.ts': "import { Mode } from 'fs'\nexport interface Root { m: Mode }" }
    expect(targetsOf(walkOver(files, [ROOT]), 'nx/src/root.ts#Root')).toEqual([
      ['Mode', { kind: 'external', module: 'node:fs', name: 'Mode' }],
    ])
  })

  it('replaces references to packages, missing exports, values, namespaces and overrides', () => {
    const files = {
      'src/root.ts': [
        "import { Pc } from 'picocolors'",
        "import { Gone } from './a'",
        "import * as ns from './a'",
        'export interface Root { p: Pc; g: Gone; v: Value; n: Ns; q: ns; h: Heavy; o: Other }',
        'export const Value = 1',
        'namespace Ns {}',
        'interface Heavy {}',
        'declare module Other {}',
      ].join('\n'),
      'src/a.ts': 'export interface A {}',
    }
    expect(targetsOf(walkOver(files, [ROOT]), 'nx/src/root.ts#Root')).toEqual([
      ['Pc', { kind: 'replace', text: 'unknown', reason: 'external-module' }],
      ['Gone', { kind: 'replace', text: 'unknown', reason: 'unresolved' }],
      ['Value', { kind: 'replace', text: 'unknown', reason: 'value-declaration' }],
      ['Ns', { kind: 'replace', text: 'unknown', reason: 'namespace' }],
      ['ns', { kind: 'replace', text: 'unknown', reason: 'namespace' }],
      ['Heavy', { kind: 'replace', text: 'object', reason: 'override' }],
      ['Other', { kind: 'replace', text: 'unknown', reason: 'namespace' }],
    ])
  })

  it('resolves qualified names through namespace imports, globals and node built-ins', () => {
    const files = {
      'src/root.ts':
        "import * as a from './a'\nimport * as fs from 'node:fs'\nimport * as pc from 'picocolors'\nexport interface Root { a: a.A; t: NodeJS.Timeout; m: fs.Mode; p: pc.Colors; d: x.y.Z }",
      'src/a.ts': 'export interface A {}',
    }
    expect(targetsOf(walkOver(files, [ROOT]), 'nx/src/root.ts#Root')).toEqual([
      ['A', { kind: 'symbol', key: 'nx/src/a.ts#A' }],
      ['Timeout', { kind: 'global' }],
      ['Mode', { kind: 'external', module: 'node:fs', name: 'Mode' }],
      ['Colors', { kind: 'replace', text: 'unknown', reason: 'external-module' }],
      ['Z', { kind: 'replace', text: 'unknown', reason: 'qualified-name' }],
    ])
  })

  it('resolves enum members to literals and namespace members to flattened symbols', () => {
    const files = {
      'src/root.ts': [
        'export interface Root { k: Kind.Static; c: Kind.Computed; m: Space.Member; v: Space.value; g: Space.Gone; i: Iface.Member; q: Block.Member }',
        "enum Kind { Static = 'static', Computed = 1 << 1 }",
        'namespace Space { export interface Member {}; export const value = 1 }',
        'interface Iface {}',
        'declare namespace Block',
      ].join('\n'),
    }
    const result = walkOver(files, [ROOT])
    expect(targetsOf(result, 'nx/src/root.ts#Root')).toEqual([
      ['Static', { kind: 'replace', text: "'static'", reason: 'enum-member' }],
      ['Computed', { kind: 'replace', text: 'unknown', reason: 'enum-member' }],
      ['Member', { kind: 'symbol', key: 'nx/src/root.ts#Space.Member' }],
      ['value', { kind: 'replace', text: 'unknown', reason: 'value-declaration' }],
      ['Gone', { kind: 'replace', text: 'unknown', reason: 'unresolved' }],
      ['Member', { kind: 'replace', text: 'unknown', reason: 'qualified-name' }],
      ['Member', { kind: 'replace', text: 'unknown', reason: 'unresolved' }],
    ])
  })

  it('treats the member of a dotted namespace and of a missing import as unresolved', () => {
    const files = {
      'src/root.ts':
        "import { Nope } from './a'\nexport interface Root { d: Dotted.X; n: Nope.X }\nnamespace Dotted.Inner { export interface X {} }",
      'src/a.ts': 'export interface A {}',
    }
    expect(targetsOf(walkOver(files, [ROOT]), 'nx/src/root.ts#Root').map(([, target]) => target)).toEqual([
      { kind: 'replace', text: 'unknown', reason: 'unresolved' },
      { kind: 'replace', text: 'unknown', reason: 'unresolved' },
    ])
  })

  it('describes a namespace member with its flattened name and a note', () => {
    const files = { 'src/root.ts': 'export interface Root { m: Space.Member }\nnamespace Space { export interface Member {} }' }
    expect(walkOver(files, [ROOT]).symbols.get('nx/src/root.ts#Space.Member')).toEqual(
      expect.objectContaining({
        name: 'Member',
        baseName: 'Space_Member',
        kind: 'type',
        notes: ['a member of the namespace Space, carried as Space_Member'],
      })
    )
  })

  it('reuses a namespace member symbol reached twice', () => {
    const files = {
      'src/root.ts': 'export interface Root { m: Space.Member; n: Space.Member }\nnamespace Space { export interface Member {} }',
    }
    expect(targetsOf(walkOver(files, [ROOT]), 'nx/src/root.ts#Root').map(([, target]) => target)).toEqual([
      { kind: 'symbol', key: 'nx/src/root.ts#Space.Member' },
      { kind: 'symbol', key: 'nx/src/root.ts#Space.Member' },
    ])
  })

  it('carries a class as a synthesized interface and an enum as an alias', () => {
    const files = { 'src/root.ts': "export interface Root { c: Klass; e: Kind }\nclass Klass { run(): void {} }\nenum Kind { A = 'a' }" }
    const result = walkOver(files, [ROOT])
    expect([result.symbols.get('nx/src/root.ts#Klass'), result.symbols.get('nx/src/root.ts#Kind')]).toEqual([
      expect.objectContaining({ kind: 'class', notes: ['a class, carried as the interface of its public instance members'] }),
      expect.objectContaining({ kind: 'enum', notes: ['an enum, carried as the union of its member values'] }),
    ])
  })

  it('follows the references of a synthesized class interface', () => {
    const files = {
      'src/root.ts':
        'export interface Root { c: Klass }\nclass Klass implements Base { run(): Out { return {} } }\ninterface Base {}\ninterface Out {}',
    }
    expect([...walkOver(files, [ROOT]).placements.keys()]).toEqual([
      'nx/src/root.ts#Root',
      'nx/src/root.ts#Klass',
      'nx/src/root.ts#Base',
      'nx/src/root.ts#Out',
    ])
  })

  it('drops the merged namespace of an interface and notes it', () => {
    const files = { 'src/root.ts': 'export interface Root {}\nexport namespace Root { export const x = 1 }' }
    expect(walkOver(files, [ROOT]).symbols.get('nx/src/root.ts#Root')).toEqual(
      expect.objectContaining({ kind: 'type', notes: ['a merged ModuleDeclaration is dropped; only the type declarations are carried'] })
    )
  })

  it('carries every declaration of a merged interface', () => {
    const files = { 'src/root.ts': 'export interface Root { a: 1 }\nexport interface Root { b: 2 }' }
    expect(walkOver(files, [ROOT]).symbols.get('nx/src/root.ts#Root')?.declarations).toHaveLength(2)
  })

  it('places a root in its own output even when an earlier request reached it', () => {
    const files = { 'src/root.ts': 'export interface Root { o: Other }\nexport interface Other { r: Root }' }
    const result = walkOver(files, [ROOT, { root: 'src/root.ts', symbols: ['Other'], depth: 0, output: 'out/other.ts' }])
    expect([...result.placements.entries()]).toEqual([
      ['nx/src/root.ts#Root', 'out/root.ts'],
      ['nx/src/root.ts#Other', 'out/other.ts'],
    ])
  })

  it('gives a shared symbol to the first request that reaches it and lists each output in request order', () => {
    const files = { 'src/root.ts': 'export interface Root { s: Shared }\nexport interface Other { s: Shared }\ninterface Shared {}' }
    const result = walkOver(files, [ROOT, { root: 'src/root.ts', symbols: ['Other'], depth: 1, output: 'out/other.ts' }])
    expect([...result.outputs.values()].map((plan) => plan.order)).toEqual([
      ['nx/src/root.ts#Root', 'nx/src/root.ts#Shared'],
      ['nx/src/root.ts#Other'],
    ])
  })

  it('stays pending when a root re-export leads to an unread module', () => {
    const files = { 'src/root.ts': "export * from './a'" }
    expect(walkOver(files, [ROOT]).pending).toEqual(expect.arrayContaining(['nx/src/a.ts']))
  })

  it('returns no placements while anything is pending', () => {
    const files = { 'src/root.ts': "import { A } from './a'\nexport interface Root { a: A }" }
    expect(walkOver(files, [ROOT]).placements.size).toBe(0)
  })

  it('handles a cycle between declarations', () => {
    const files = { 'src/root.ts': 'export interface Root { a: A }\ninterface A { r: Root }' }
    expect([...walkOver(files, [ROOT]).placements.keys()]).toEqual(['nx/src/root.ts#Root', 'nx/src/root.ts#A'])
  })
})
