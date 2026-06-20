import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
    write('a/index.esm.js', "import { x } from '../b/index.esm.js';\nexport const y = x;")
    expect(destructureRequiresPass(depsRoot).requireBindingsDestructured).toBe(0)
  })

  it('destructures an acyclic require edge between chunks', () => {
    write('a/index.cjs.js', "const b = require('../b/index.cjs.js');\nexports.abs = b.abs;")
    write('b/index.cjs.js', 'const abs = Math.abs;\nexports.abs = abs;')
    expect(destructureRequiresPass(depsRoot).requireBindingsDestructured).toBe(1)
    expect(read('a/index.cjs.js')).toContain("const { abs } = require('../b/index.cjs.js')")
  })

  it('destructures two chunks that both require a shared third chunk', () => {
    write('a/index.cjs.js', "const c = require('../c/index.cjs.js');\nexports.x = c.foo;")
    write('b/index.cjs.js', "const c = require('../c/index.cjs.js');\nexports.y = c.foo;")
    write('c/index.cjs.js', 'const foo = 1;\nexports.foo = foo;')
    expect(destructureRequiresPass(depsRoot).requireBindingsDestructured).toBe(2)
    expect(read('a/index.cjs.js')).toContain("const { foo } = require('../c/index.cjs.js')")
    expect(read('b/index.cjs.js')).toContain("const { foo } = require('../c/index.cjs.js')")
  })

  it('leaves cyclic require edges as namespace bindings', () => {
    write('a/index.cjs.js', "const b = require('../b/index.cjs.js');\nconst fa = () => b.fb();\nexports.fa = fa;")
    write('b/index.cjs.js', "const a = require('../a/index.cjs.js');\nconst fb = () => a.fa();\nexports.fb = fb;")
    expect(destructureRequiresPass(depsRoot).requireBindingsDestructured).toBe(0)
    expect(read('a/index.cjs.js')).toContain("const b = require('../b/index.cjs.js')")
    expect(read('b/index.cjs.js')).toContain("const a = require('../a/index.cjs.js')")
  })

  it('bails the whole pass when any chunk has a dynamic specifier', () => {
    write('a/index.cjs.js', "const b = require('../b/index.cjs.js');\nexports.abs = b.abs;")
    write('b/index.cjs.js', 'const abs = Math.abs;\nexports.abs = abs;\nconst dyn = require(globalThis.name);')
    expect(destructureRequiresPass(depsRoot).requireBindingsDestructured).toBe(0)
    expect(read('a/index.cjs.js')).toContain("const b = require('../b/index.cjs.js')")
  })

  it('does not destructure a require targeting code outside the chunk set', () => {
    write('a/index.cjs.js', "const ext = require('../../outside.cjs.js');\nexports.x = ext.foo;")
    expect(destructureRequiresPass(depsRoot).requireBindingsDestructured).toBe(0)
    expect(read('a/index.cjs.js')).toContain("const ext = require('../../outside.cjs.js')")
  })
})
