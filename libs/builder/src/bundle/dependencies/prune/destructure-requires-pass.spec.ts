import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { destructureRequiresPass } from './destructure-requires-pass'

describe('destructureRequiresPass', () => {
  const depsDir = useTempDir({ prefix: 'builder-destructure-' })

  it('returns zero when the deps root does not exist', () => {
    expect(destructureRequiresPass(depsDir.resolve('missing')).requireBindingsDestructured).toBe(0)
  })

  it('returns zero when there are no CJS chunks', () => {
    depsDir.write('a/index.mjs', "import { x } from '../b/index.mjs';\nexport const y = x;")
    expect(destructureRequiresPass(depsDir.path).requireBindingsDestructured).toBe(0)
  })

  it('reports one destructured binding for an acyclic require edge between chunks', () => {
    depsDir.write('a/index.cjs', "const b = require('../b/index.cjs');\nexports.abs = b.abs;")
    depsDir.write('b/index.cjs', 'const abs = Math.abs;\nexports.abs = abs;')
    expect(destructureRequiresPass(depsDir.path).requireBindingsDestructured).toBe(1)
  })

  it('rewrites an acyclic require edge between chunks to a destructure', () => {
    depsDir.write('a/index.cjs', "const b = require('../b/index.cjs');\nexports.abs = b.abs;")
    depsDir.write('b/index.cjs', 'const abs = Math.abs;\nexports.abs = abs;')
    destructureRequiresPass(depsDir.path)
    expect(depsDir.read('a/index.cjs')).toContain("const { abs } = require('../b/index.cjs')")
  })

  it('reports one destructured binding per chunk requiring a shared third chunk', () => {
    depsDir.write('a/index.cjs', "const c = require('../c/index.cjs');\nexports.x = c.foo;")
    depsDir.write('b/index.cjs', "const c = require('../c/index.cjs');\nexports.y = c.foo;")
    depsDir.write('c/index.cjs', 'const foo = 1;\nexports.foo = foo;')
    expect(destructureRequiresPass(depsDir.path).requireBindingsDestructured).toBe(2)
  })

  it('rewrites both requires of a shared third chunk to destructures', () => {
    depsDir.write('a/index.cjs', "const c = require('../c/index.cjs');\nexports.x = c.foo;")
    depsDir.write('b/index.cjs', "const c = require('../c/index.cjs');\nexports.y = c.foo;")
    depsDir.write('c/index.cjs', 'const foo = 1;\nexports.foo = foo;')
    destructureRequiresPass(depsDir.path)
    expect([depsDir.read('a/index.cjs'), depsDir.read('b/index.cjs')]).toEqual([
      expect.stringContaining("const { foo } = require('../c/index.cjs')"),
      expect.stringContaining("const { foo } = require('../c/index.cjs')"),
    ])
  })

  it('reports zero destructured bindings for a cyclic require edge', () => {
    depsDir.write('a/index.cjs', "const b = require('../b/index.cjs');\nconst fa = () => b.fb();\nexports.fa = fa;")
    depsDir.write('b/index.cjs', "const a = require('../a/index.cjs');\nconst fb = () => a.fa();\nexports.fb = fb;")
    expect(destructureRequiresPass(depsDir.path).requireBindingsDestructured).toBe(0)
  })

  it('leaves cyclic require edges as namespace bindings', () => {
    const chunkA = "const b = require('../b/index.cjs');\nconst fa = () => b.fb();\nexports.fa = fa;"
    const chunkB = "const a = require('../a/index.cjs');\nconst fb = () => a.fa();\nexports.fb = fb;"
    depsDir.write('a/index.cjs', chunkA)
    depsDir.write('b/index.cjs', chunkB)
    destructureRequiresPass(depsDir.path)
    expect([depsDir.read('a/index.cjs'), depsDir.read('b/index.cjs')]).toEqual([chunkA, chunkB])
  })

  it('reports zero destructured bindings when any chunk has a dynamic specifier', () => {
    depsDir.write('a/index.cjs', "const b = require('../b/index.cjs');\nexports.abs = b.abs;")
    depsDir.write('b/index.cjs', 'const abs = Math.abs;\nexports.abs = abs;\nconst dyn = require(globalThis.name);')
    expect(destructureRequiresPass(depsDir.path).requireBindingsDestructured).toBe(0)
  })

  it('leaves every require alone when any chunk has a dynamic specifier', () => {
    const consumer = "const b = require('../b/index.cjs');\nexports.abs = b.abs;"
    depsDir.write('a/index.cjs', consumer)
    depsDir.write('b/index.cjs', 'const abs = Math.abs;\nexports.abs = abs;\nconst dyn = require(globalThis.name);')
    destructureRequiresPass(depsDir.path)
    expect(depsDir.read('a/index.cjs')).toBe(consumer)
  })

  it('reports zero destructured bindings for a require targeting code outside the chunk set', () => {
    depsDir.write('a/index.cjs', "const ext = require('../../outside.cjs');\nexports.x = ext.foo;")
    expect(destructureRequiresPass(depsDir.path).requireBindingsDestructured).toBe(0)
  })

  it('leaves a require targeting code outside the chunk set alone', () => {
    const consumer = "const ext = require('../../outside.cjs');\nexports.x = ext.foo;"
    depsDir.write('a/index.cjs', consumer)
    destructureRequiresPass(depsDir.path)
    expect(depsDir.read('a/index.cjs')).toBe(consumer)
  })
})
