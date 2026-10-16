import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { destructureRequiresPass } from './destructure-requires-pass'

describe('destructureRequiresPass', () => {
  let depsRoot: string

  beforeEach(() => {
    depsRoot = mkdtempSync(join(tmpdir(), 'builder-destructure-'))
  })

  afterEach(() => {
    rmSync(depsRoot, { recursive: true, force: true })
  })

  const write = (relPath: string, content: string): void => {
    const abs = join(depsRoot, relPath)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, content)
  }

  const read = (relPath: string): string => readFileSync(join(depsRoot, relPath), 'utf8')

  it('returns zero when the deps root does not exist', () => {
    expect(destructureRequiresPass(join(depsRoot, 'missing')).requireBindingsDestructured).toBe(0)
  })

  it('returns zero when there are no CJS chunks', () => {
    write('a/index.mjs', "import { x } from '../b/index.mjs';\nexport const y = x;")
    expect(destructureRequiresPass(depsRoot).requireBindingsDestructured).toBe(0)
  })

  it('reports one destructured binding for an acyclic require edge between chunks', () => {
    write('a/index.cjs', "const b = require('../b/index.cjs');\nexports.abs = b.abs;")
    write('b/index.cjs', 'const abs = Math.abs;\nexports.abs = abs;')
    expect(destructureRequiresPass(depsRoot).requireBindingsDestructured).toBe(1)
  })

  it('rewrites an acyclic require edge between chunks to a destructure', () => {
    write('a/index.cjs', "const b = require('../b/index.cjs');\nexports.abs = b.abs;")
    write('b/index.cjs', 'const abs = Math.abs;\nexports.abs = abs;')
    destructureRequiresPass(depsRoot)
    expect(read('a/index.cjs')).toContain("const { abs } = require('../b/index.cjs')")
  })

  it('reports one destructured binding per chunk requiring a shared third chunk', () => {
    write('a/index.cjs', "const c = require('../c/index.cjs');\nexports.x = c.foo;")
    write('b/index.cjs', "const c = require('../c/index.cjs');\nexports.y = c.foo;")
    write('c/index.cjs', 'const foo = 1;\nexports.foo = foo;')
    expect(destructureRequiresPass(depsRoot).requireBindingsDestructured).toBe(2)
  })

  it('rewrites both requires of a shared third chunk to destructures', () => {
    write('a/index.cjs', "const c = require('../c/index.cjs');\nexports.x = c.foo;")
    write('b/index.cjs', "const c = require('../c/index.cjs');\nexports.y = c.foo;")
    write('c/index.cjs', 'const foo = 1;\nexports.foo = foo;')
    destructureRequiresPass(depsRoot)
    expect([read('a/index.cjs'), read('b/index.cjs')]).toEqual([
      expect.stringContaining("const { foo } = require('../c/index.cjs')"),
      expect.stringContaining("const { foo } = require('../c/index.cjs')"),
    ])
  })

  it('reports zero destructured bindings for a cyclic require edge', () => {
    write('a/index.cjs', "const b = require('../b/index.cjs');\nconst fa = () => b.fb();\nexports.fa = fa;")
    write('b/index.cjs', "const a = require('../a/index.cjs');\nconst fb = () => a.fa();\nexports.fb = fb;")
    expect(destructureRequiresPass(depsRoot).requireBindingsDestructured).toBe(0)
  })

  it('leaves cyclic require edges as namespace bindings', () => {
    const chunkA = "const b = require('../b/index.cjs');\nconst fa = () => b.fb();\nexports.fa = fa;"
    const chunkB = "const a = require('../a/index.cjs');\nconst fb = () => a.fa();\nexports.fb = fb;"
    write('a/index.cjs', chunkA)
    write('b/index.cjs', chunkB)
    destructureRequiresPass(depsRoot)
    expect([read('a/index.cjs'), read('b/index.cjs')]).toEqual([chunkA, chunkB])
  })

  it('reports zero destructured bindings when any chunk has a dynamic specifier', () => {
    write('a/index.cjs', "const b = require('../b/index.cjs');\nexports.abs = b.abs;")
    write('b/index.cjs', 'const abs = Math.abs;\nexports.abs = abs;\nconst dyn = require(globalThis.name);')
    expect(destructureRequiresPass(depsRoot).requireBindingsDestructured).toBe(0)
  })

  it('leaves every require alone when any chunk has a dynamic specifier', () => {
    const consumer = "const b = require('../b/index.cjs');\nexports.abs = b.abs;"
    write('a/index.cjs', consumer)
    write('b/index.cjs', 'const abs = Math.abs;\nexports.abs = abs;\nconst dyn = require(globalThis.name);')
    destructureRequiresPass(depsRoot)
    expect(read('a/index.cjs')).toBe(consumer)
  })

  it('reports zero destructured bindings for a require targeting code outside the chunk set', () => {
    write('a/index.cjs', "const ext = require('../../outside.cjs');\nexports.x = ext.foo;")
    expect(destructureRequiresPass(depsRoot).requireBindingsDestructured).toBe(0)
  })

  it('leaves a require targeting code outside the chunk set alone', () => {
    const consumer = "const ext = require('../../outside.cjs');\nexports.x = ext.foo;"
    write('a/index.cjs', consumer)
    destructureRequiresPass(depsRoot)
    expect(read('a/index.cjs')).toBe(consumer)
  })
})
