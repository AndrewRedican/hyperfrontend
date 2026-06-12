import type { ChunkFormat } from './used-exports'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join as nodeJoin } from 'node:path'
import { join } from '@hyperfrontend/project-scope/core'
import { collectImportEdges, collectUsedExports } from './used-exports'

const IMPORTER_DIR = '/imp'
const target = (specifier: string): string => join(IMPORTER_DIR, specifier)

const edgesObj = (source: string, format: ChunkFormat): Record<string, 'all' | string[]> => {
  const out: Record<string, 'all' | string[]> = {}
  for (const [path, usage] of collectImportEdges(source, IMPORTER_DIR, format)) out[path] = usage === 'all' ? 'all' : [...usage].sort()
  return out
}

describe('collectImportEdges (esm)', () => {
  it('ignores a bare (non-relative) import specifier', () => {
    expect(edgesObj("import { x } from 'rollup'", 'esm')).toEqual({})
  })

  it('records a side-effect-only import with an empty demand', () => {
    expect(edgesObj("import './x.js'", 'esm')).toEqual({ [target('./x.js')]: [] })
  })

  it('bails to all for a default import', () => {
    expect(edgesObj("import d from './x.js'", 'esm')).toEqual({ [target('./x.js')]: 'all' })
  })

  it('bails to all for a namespace import', () => {
    expect(edgesObj("import * as ns from './x.js'", 'esm')).toEqual({ [target('./x.js')]: 'all' })
  })

  it('collects named imports using the original exported name', () => {
    expect(edgesObj("import { a, b as c } from './x.js'", 'esm')).toEqual({ [target('./x.js')]: ['a', 'b'] })
  })

  it('collects names from a re-export with a module specifier', () => {
    expect(edgesObj("export { a } from './x.js'", 'esm')).toEqual({ [target('./x.js')]: ['a'] })
  })

  it('bails to all for an export-star re-export', () => {
    expect(edgesObj("export * from './x.js'", 'esm')).toEqual({ [target('./x.js')]: 'all' })
  })

  it('collects the original name from an aliased re-export', () => {
    expect(edgesObj("export { a as b } from './x.js'", 'esm')).toEqual({ [target('./x.js')]: ['a'] })
  })

  it('bails to all for a namespace re-export', () => {
    expect(edgesObj("export * as ns from './x.js'", 'esm')).toEqual({ [target('./x.js')]: 'all' })
  })

  it('ignores a non-relative re-export specifier', () => {
    expect(edgesObj("export { a } from 'rollup'", 'esm')).toEqual({})
  })

  it('stays at all when a named import follows a namespace import of the same module', () => {
    expect(edgesObj("import * as ns from './x.js';\nimport { a } from './x.js'", 'esm')).toEqual({ [target('./x.js')]: 'all' })
  })
})

describe('collectImportEdges (cjs)', () => {
  it('collects member accesses on a namespace require binding', () => {
    expect(edgesObj("var ns = require('./x.cjs.js'); ns.foo(); ns.bar", 'cjs')).toEqual({ [target('./x.cjs.js')]: ['bar', 'foo'] })
  })

  it('collects a string-literal element access on a namespace binding', () => {
    expect(edgesObj("var ns = require('./x.cjs.js'); ns['foo']", 'cjs')).toEqual({ [target('./x.cjs.js')]: ['foo'] })
  })

  it('bails to all for a computed element access on a namespace binding', () => {
    expect(edgesObj('var ns = require("./x.cjs.js"); ns[k]', 'cjs')).toEqual({ [target('./x.cjs.js')]: 'all' })
  })

  it('bails to all when a namespace binding is used wholesale', () => {
    expect(edgesObj("var ns = require('./x.cjs.js'); use(ns)", 'cjs')).toEqual({ [target('./x.cjs.js')]: 'all' })
  })

  it('ignores the binding name appearing as another object property key', () => {
    expect(edgesObj("var ns = require('./x.cjs.js'); other.ns", 'cjs')).toEqual({})
  })

  it('collects names from a destructured require', () => {
    expect(edgesObj("var { a, b } = require('./x.cjs.js')", 'cjs')).toEqual({ [target('./x.cjs.js')]: ['a', 'b'] })
  })

  it('collects the source key from a renamed destructured require', () => {
    expect(edgesObj("var { a: x } = require('./x.cjs.js')", 'cjs')).toEqual({ [target('./x.cjs.js')]: ['a'] })
  })

  it('bails to all for a rest element in a destructured require', () => {
    expect(edgesObj("var { ...rest } = require('./x.cjs.js')", 'cjs')).toEqual({ [target('./x.cjs.js')]: 'all' })
  })

  it('bails to all for a computed key in a destructured require', () => {
    expect(edgesObj("var { ['a']: x } = require('./x.cjs.js')", 'cjs')).toEqual({ [target('./x.cjs.js')]: 'all' })
  })

  it('bails to all for an array-destructured require', () => {
    expect(edgesObj("var [a] = require('./x.cjs.js')", 'cjs')).toEqual({ [target('./x.cjs.js')]: 'all' })
  })

  it('collects a direct property access on the require call', () => {
    expect(edgesObj("var x = require('./x.cjs.js').foo", 'cjs')).toEqual({ [target('./x.cjs.js')]: ['foo'] })
  })

  it('bails to all when require is used as a call argument', () => {
    expect(edgesObj("register(require('./x.cjs.js'))", 'cjs')).toEqual({ [target('./x.cjs.js')]: 'all' })
  })

  it('ignores a non-relative require specifier', () => {
    expect(edgesObj("var ns = require('rollup'); ns.x", 'cjs')).toEqual({})
  })
})

describe('collectUsedExports', () => {
  let root: string
  let chunkPath: string

  beforeEach(() => {
    root = mkdtempSync(nodeJoin(tmpdir(), 'builder-used-exports-'))
    chunkPath = join(root, 'dep.esm.js')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const writeImporter = (name: string, content: string): string => {
    const abs = nodeJoin(root, name)
    mkdirSync(nodeJoin(abs, '..'), { recursive: true })
    writeFileSync(abs, content)
    return abs
  }

  it('unions the named demand across multiple importers', () => {
    const a = writeImporter('a.esm.js', "import { foo } from './dep.esm.js'")
    const b = writeImporter('b.esm.js', "import { bar } from './dep.esm.js'")
    expect([...(<Set<string>>collectUsedExports([a, b], chunkPath, 'esm'))].sort()).toEqual(['bar', 'foo'])
  })

  it('returns all the moment any importer consumes the chunk wholesale', () => {
    const a = writeImporter('a.esm.js', "import { foo } from './dep.esm.js'")
    const b = writeImporter('b.esm.js', "import * as ns from './dep.esm.js'")
    expect(collectUsedExports([a, b], chunkPath, 'esm')).toBe('all')
  })

  it('returns an empty set when no importer references the chunk', () => {
    const a = writeImporter('a.esm.js', "import { x } from './other.esm.js'")
    expect([...(<Set<string>>collectUsedExports([a], chunkPath, 'esm'))]).toEqual([])
  })

  it('skips importer files that do not exist on disk', () => {
    expect([...(<Set<string>>collectUsedExports([nodeJoin(root, 'missing.esm.js')], chunkPath, 'esm'))]).toEqual([])
  })
})
