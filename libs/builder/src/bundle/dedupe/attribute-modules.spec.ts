import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import ts from 'typescript'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { attribute, baseName, chunkFileName, fingerprintOf, indexOwners, parseEntry, sharedDirFor } from './attribute-modules'

describe('baseName', () => {
  it('strips a collision-rename suffix', () => {
    expect(baseName('Store$12')).toBe('Store')
  })

  it('leaves an unsuffixed name unchanged', () => {
    expect(baseName('Store')).toBe('Store')
  })
})

describe('fingerprintOf', () => {
  const fingerprint = (source: string): string => {
    const sourceFile = ts.createSourceFile('chunk.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
    return fingerprintOf(<ts.Statement>sourceFile.statements[0], sourceFile)
  }

  it('strips $N from a dep-namespace property access', () => {
    expect(fingerprint('const x = index_cjs_js$2.getType();')).toBe('const x = index_cjs_js.getType();')
  })

  it('strips $N from a collision-renamed reference', () => {
    expect(fingerprint('const make = () => new Store$1();')).toBe('const make = () => new Store();')
  })

  it('leaves a $-bearing string literal untouched', () => {
    expect(fingerprint('const price = "$2";')).toBe('const price = "$2";')
  })

  it('produces equal fingerprints for two copies differing only by $N', () => {
    expect(fingerprint('const a = dep$1.f();')).toBe(fingerprint('const a = dep$3.f();'))
  })

  it('produces unequal fingerprints for a genuine body difference', () => {
    expect(fingerprint('const a = dep$1.f();')).not.toBe(fingerprint('const a = dep$1.g();'))
  })
})

describe('chunkFileName', () => {
  it('names the CJS chunk file', () => {
    expect(chunkFileName('cjs')).toBe('index.cjs.js')
  })
})

describe('sharedDirFor', () => {
  it('places a module under the _shared root', () => {
    expect(sharedDirFor('events/events')).toBe('_shared/events/events')
  })
})

describe('parseEntry', () => {
  it('captures a named ESM import binding', () => {
    expect(parseEntry("import { a } from 'x';", 'esm').importBindings.get('a')).toEqual({ specifier: 'x', kind: 'named', imported: 'a' })
  })

  it('records the imported name for an aliased ESM import', () => {
    expect(parseEntry("import { a as b } from 'x';", 'esm').importBindings.get('b')).toEqual({
      specifier: 'x',
      kind: 'named',
      imported: 'a',
    })
  })

  it('captures a namespace ESM import binding', () => {
    expect(parseEntry("import * as ns from 'x';", 'esm').importBindings.get('ns')).toEqual({ specifier: 'x', kind: 'namespace' })
  })

  it('captures a default ESM import binding', () => {
    expect(parseEntry("import d from 'x';", 'esm').importBindings.get('d')).toEqual({ specifier: 'x', kind: 'default' })
  })

  it('records no binding for a side-effect-only ESM import', () => {
    expect(parseEntry("import 'x';", 'esm').importBindings.size).toBe(0)
  })

  it('captures a CJS namespace require binding', () => {
    expect(parseEntry("var ns = require('x');", 'cjs').importBindings.get('ns')).toEqual({ specifier: 'x', kind: 'cjs-namespace' })
  })

  it('captures a CJS property-access require binding', () => {
    expect(parseEntry("var a = require('x').foo;", 'cjs').importBindings.get('a')).toEqual({
      specifier: 'x',
      kind: 'cjs-named',
      imported: 'foo',
    })
  })

  it('captures an aliased CJS destructuring require binding', () => {
    expect(parseEntry("const { a: c } = require('x');", 'cjs').importBindings.get('c')).toEqual({
      specifier: 'x',
      kind: 'cjs-named',
      imported: 'a',
    })
  })

  it('captures an unaliased CJS destructuring require binding', () => {
    expect(parseEntry("const { a } = require('x');", 'cjs').importBindings.get('a')).toEqual({
      specifier: 'x',
      kind: 'cjs-named',
      imported: 'a',
    })
  })

  it('records a single-name runtime declaration', () => {
    expect(parseEntry('class C {}', 'esm').decls).toEqual([expect.objectContaining({ base: 'C', localName: 'C' })])
  })

  it('excludes an inline-exported declaration from the removable set', () => {
    expect(parseEntry('export const a = 1;', 'esm').decls).toEqual([])
  })

  it('routes a multi-declarator statement to the bare set rather than a declaration', () => {
    expect(parseEntry('const a = 1, b = 2;', 'esm').decls).toEqual([])
  })

  it('treats the ESM export list as neither a declaration nor a bare statement', () => {
    const parsed = parseEntry('const a = 1;\nexport { a };', 'esm')
    expect([parsed.decls.length, parsed.bareStatements.length]).toEqual([1, 0])
  })

  it('treats a CJS exports assignment as the export surface', () => {
    const parsed = parseEntry("'use strict';\nconst a = 1;\nexports.a = a;", 'cjs')
    expect(parsed.bareStatements).toEqual([])
  })

  it('collects a bare side-effecting statement', () => {
    expect(parseEntry('sideEffect();', 'esm').bareStatements).toHaveLength(1)
  })

  it('points the header end past the leading imports', () => {
    expect(parseEntry("import { a } from 'x';\nconst b = 1;", 'esm').headerEnd).toBe("import { a } from 'x';".length)
  })

  it('reports a zero header end when no header precedes the body', () => {
    expect(parseEntry('const b = 1;', 'esm').headerEnd).toBe(0)
  })
})

describe('attribute', () => {
  const ownerOf = createMap<string, string>()
  ownerOf.set('greet', 'greet/greet')
  const owners = { ownerOf }

  it('groups a declaration under its owning module', () => {
    expect(attribute(parseEntry('const greet = 1;', 'esm'), owners).get('greet/greet')).toEqual([
      expect.objectContaining({ base: 'greet' }),
    ])
  })

  it('skips a declaration whose name is unowned', () => {
    expect(attribute(parseEntry('const other = 1;', 'esm'), owners).has('greet/greet')).toBe(false)
  })
})

describe('indexOwners', () => {
  let src: string

  const writeSrc = (relPath: string, content: string): void => {
    const abs = join(src, relPath)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }

  beforeEach(() => {
    src = mkdtempSync(join(tmpdir(), 'builder-owners-'))
  })

  afterEach(() => {
    rmSync(src, { recursive: true, force: true })
  })

  it('maps an exported runtime symbol to its module key', () => {
    writeSrc('store/store.ts', 'export class Store {}\n')
    expect(indexOwners(src).ownerOf.get('Store')).toBe('store/store')
  })

  it('omits a symbol exported by two different modules', () => {
    writeSrc('a/a.ts', 'export const dup = 1\n')
    writeSrc('b/b.ts', 'export const dup = 2\n')
    expect(indexOwners(src).ownerOf.has('dup')).toBe(false)
  })

  it('attributes a private top-level helper to its module', () => {
    writeSrc('a/a.ts', 'const helper = 1\nexport const shown = helper\n')
    expect(indexOwners(src).ownerOf.get('helper')).toBe('a/a')
  })

  it('skips declaration files and spec files', () => {
    writeSrc('a/a.d.ts', 'export declare const typed: number\n')
    writeSrc('a/a.spec.ts', 'export const fromSpec = 1\n')
    expect(indexOwners(src).ownerOf.size).toBe(0)
  })
})
