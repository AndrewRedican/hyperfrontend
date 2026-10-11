import { describe, expect, it } from '@hyperfrontend/testing'
import { destructureRequires } from './destructure-requires'

const CHUNK_DIR = '/d/p'

const run = (source: string, isSafe: (target: string) => boolean = () => true): ReturnType<typeof destructureRequires> =>
  destructureRequires(source, CHUNK_DIR, isSafe)

describe('destructureRequires', () => {
  it('collapses a single-member require to a destructure and rewrites the access', () => {
    const result = run("const m = require('./math/index.cjs');\nm.abs(x);")
    expect(result).not.toBeNull()
    expect(result?.rewrittenBindings).toBe(1)
    expect(result?.code).toBe("const { abs } = require('./math/index.cjs');\nabs(x);")
  })

  it('collects members from property and string-element access, sorted', () => {
    const result = run("const m = require('./x.cjs');\nm.max(a);\nm['min'](b);")
    expect(result?.code).toBe("const { max, min } = require('./x.cjs');\nmax(a);\nmin(b);")
  })

  it('aliases a member that collides with an existing free identifier', () => {
    const result = run("const abs = 1;\nconst m = require('./x.cjs');\nuse(m.abs);")
    expect(result?.code).toBe("const abs = 1;\nconst { abs: abs$1 } = require('./x.cjs');\nuse(abs$1);")
  })

  it('aliases a member shared by two requires so the bound locals stay distinct', () => {
    const result = run("const a = require('./a.cjs');\nconst b = require('./b.cjs');\nuse(a.foo, b.foo);")
    expect(result?.rewrittenBindings).toBe(2)
    expect(result?.code).toBe("const { foo } = require('./a.cjs');\nconst { foo: foo$1 } = require('./b.cjs');\nuse(foo, foo$1);")
  })

  it('unions repeated reads of the same member into one bound local', () => {
    const result = run("const m = require('./x.cjs');\nm.abs(a);\nm.abs(b);")
    expect(result?.code).toBe("const { abs } = require('./x.cjs');\nabs(a);\nabs(b);")
  })

  it('bumps the alias suffix past every taken candidate name', () => {
    const result = run("const foo = 1;\nconst foo$1 = 2;\nconst m = require('./x.cjs');\nuse(m.foo, foo, foo$1);")
    expect(result?.code).toBe("const foo = 1;\nconst foo$1 = 2;\nconst { foo: foo$2 } = require('./x.cjs');\nuse(foo$2, foo, foo$1);")
  })

  it('ignores an inline require member access that binds nothing', () => {
    expect(run("require('./x.cjs').foo;")).toBeNull()
  })

  it('ignores an already-destructured require', () => {
    expect(run("const { a } = require('./x.cjs');\nuse(a);")).toBeNull()
  })

  it('leaves a binding alone when it is consumed wholesale', () => {
    expect(run("const m = require('./x.cjs');\nuse(m);")).toBeNull()
  })

  it('leaves a binding alone when it is dynamically indexed', () => {
    expect(run("const m = require('./x.cjs');\nm[k]();")).toBeNull()
  })

  it('stays bailed across a later member read once any wholesale use is seen', () => {
    expect(run("const m = require('./x.cjs');\nuse(m);\nm.foo;")).toBeNull()
  })

  it('does not reserve names that appear only as object keys or destructure keys', () => {
    const result = run("const m = require('./x.cjs');\nconst o = { foo: 1 };\nconst { bar: baz } = obj;\nuse(m.foo, o, baz);")
    expect(result?.code).toBe("const { foo } = require('./x.cjs');\nconst o = { foo: 1 };\nconst { bar: baz } = obj;\nuse(foo, o, baz);")
  })

  it('ignores the binding name appearing as another object member', () => {
    const result = run("const m = require('./x.cjs');\nobj.m;\nm.abs;")
    expect(result?.code).toBe("const { abs } = require('./x.cjs');\nobj.m;\nabs;")
  })

  it('leaves a binding alone when a member name is not a valid identifier', () => {
    expect(run("const m = require('./x.cjs');\nm['foo-bar'](a);")).toBeNull()
  })

  it('leaves a binding alone when a member name is a reserved word', () => {
    expect(run("const m = require('./x.cjs');\nm.default(a);")).toBeNull()
  })

  it('bails the whole binding when one unsafe member sits beside valid ones', () => {
    expect(run("const m = require('./x.cjs');\nm.abs(a);\nm.default(b);")).toBeNull()
  })

  it('skips a non-relative require specifier', () => {
    expect(run("const m = require('rollup');\nm.x;")).toBeNull()
  })

  it('skips a target the safety predicate rejects', () => {
    expect(run("const m = require('./x.cjs');\nm.abs;", () => false)).toBeNull()
  })

  it('drops a local bound by two requires from consideration', () => {
    expect(run("var m = require('./x.cjs');\nvar m = require('./y.cjs');\nm.a;")).toBeNull()
  })

  it('returns null when the chunk has no require bindings', () => {
    expect(run('const x = 1;\nuse(x);')).toBeNull()
  })

  it('returns null when a require binding is never read', () => {
    expect(run("const m = require('./x.cjs');\nconst y = 1;\nuse(y);")).toBeNull()
  })
})
