import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { stripDeadExports } from './dead-exports'

const keepOf = (...names: string[]): Set<string> => createSet(names)

describe('stripDeadExports', () => {
  it('returns null when the demand is all', () => {
    expect(stripDeadExports('const a = 1;\nexport { a };', 'esm', 'all')).toBeNull()
  })

  it('returns null when every export is demanded', () => {
    expect(stripDeadExports('const a = 1;\nexport { a };', 'esm', keepOf('a'))).toBeNull()
  })

  it('reports the exported name it splices out', () => {
    expect(stripDeadExports('const a = 1;\nconst b = 2;\nexport { a, b };', 'esm', keepOf('a'))?.removedNames).toEqual(['b'])
  })

  it('drops the dead declaration from the emitted code', () => {
    expect(stripDeadExports('const a = 1;\nconst b = 2;\nexport { a, b };', 'esm', keepOf('a'))?.code).not.toContain('const b')
  })

  it('narrows the export list to the surviving name', () => {
    expect(stripDeadExports('const a = 1;\nconst b = 2;\nexport { a, b };', 'esm', keepOf('a'))?.code).toContain('export { a };')
  })

  it('deletes the export statement entirely when no export survives', () => {
    expect(stripDeadExports('const a = 1;\nexport { a };', 'esm', keepOf())?.code).not.toContain('export')
  })

  it('renders an aliased export when the local and exported names differ', () => {
    expect(stripDeadExports('const a = 1;\nconst b = 2;\nexport { a as x, b as y };', 'esm', keepOf('x'))?.code).toContain(
      'export { a as x };'
    )
  })

  it('removes an inline-exported declaration', () => {
    expect(stripDeadExports('export const a = 1;', 'esm', keepOf())?.removedNames).toEqual(['a'])
  })

  it('removes an exported function declaration', () => {
    expect(stripDeadExports('function f() {}\nexport { f };', 'esm', keepOf())?.removedNames).toEqual(['f'])
  })

  it('removes an exported class declaration', () => {
    expect(stripDeadExports('class C {}\nexport { C };', 'esm', keepOf())?.removedNames).toEqual(['C'])
  })

  it('removes an arrow-initialized export despite a call inside its body', () => {
    expect(stripDeadExports('const a = () => compute();\nexport { a };', 'esm', keepOf())?.removedNames).toEqual(['a'])
  })

  it('removes an export with no initializer', () => {
    expect(stripDeadExports('let a;\nexport { a };', 'esm', keepOf())?.removedNames).toEqual(['a'])
  })

  it('retains an export whose initializer calls a function', () => {
    expect(stripDeadExports('const a = compute();\nexport { a };', 'esm', keepOf())).toBeNull()
  })

  it('retains an export whose initializer constructs an instance', () => {
    expect(stripDeadExports('const a = new Thing();\nexport { a };', 'esm', keepOf())).toBeNull()
  })

  it('retains an export referenced by a bare side-effecting statement', () => {
    expect(stripDeadExports('const a = 1;\nsideEffect(a);\nexport { a };', 'esm', keepOf())).toBeNull()
  })

  it('keeps a private helper transitively referenced by a kept export', () => {
    expect(
      stripDeadExports('function helper() {}\nfunction main() { return helper(); }\nexport { main };', 'esm', keepOf('main'))
    ).toBeNull()
  })

  it('removes a private helper once its only referencing export is removed', () => {
    expect(
      stripDeadExports('function helper() {}\nfunction main() { return helper(); }\nexport { main };', 'esm', keepOf())?.code
    ).not.toContain('helper')
  })

  it('counts only the exported name when removing it with its private helper', () => {
    expect(
      stripDeadExports('function helper() {}\nfunction main() { return helper(); }\nexport { main };', 'esm', keepOf())?.removedNames
    ).toEqual(['main'])
  })

  it('does not treat an object-literal property key as a reference to a like-named declaration', () => {
    expect(stripDeadExports('const b = 2;\nconst a = { b: 1 };\nexport { a };', 'esm', keepOf('a'))?.code).not.toContain('const b')
  })

  it('drops a whole import statement left unreferenced after a removal', () => {
    expect(stripDeadExports("import { dep } from './d/index.esm.js';\nconst a = dep;\nexport { a };", 'esm', keepOf())?.code).not.toContain(
      'import'
    )
  })

  it('narrows a partially-used named import to the surviving binding', () => {
    const source = "import { keep1, drop1 } from './d/index.esm.js';\nconst x = keep1;\nconst y = drop1;\nexport { x, y };"
    expect(stripDeadExports(source, 'esm', keepOf('x'))?.code).toContain("import { keep1 } from './d/index.esm.js';")
  })

  it('collapses blank-line runs left by splicing', () => {
    expect(stripDeadExports('const a = 1;\n\n\nconst b = 2;\nexport { b };', 'esm', keepOf('b'))?.code).not.toContain('\n\n\n')
  })

  it('removes a cjs exports assignment for a dead declaration', () => {
    const source = "'use strict';\nconst a = 1;\nconst b = 2;\nexports.a = a;\nexports.b = b;"
    expect(stripDeadExports(source, 'cjs', keepOf('a'))?.code).not.toContain('exports.b')
  })

  it('drops an unused cjs require statement after stripping its only consumer', () => {
    const source = "'use strict';\nvar dep = require('./d/index.cjs.js');\nconst a = dep.foo;\nexports.a = a;"
    expect(stripDeadExports(source, 'cjs', keepOf())?.code).not.toContain('require')
  })

  it('narrows an aliased named import to the surviving binding', () => {
    const source = "import { a as b, c as d } from './x.js';\nconst u = b;\nconst v = d;\nexport { u, v };"
    expect(stripDeadExports(source, 'esm', keepOf('u'))?.code).toContain("import { a as b } from './x.js';")
  })

  it('leaves a namespace import untouched while stripping a dead export', () => {
    const source = "import * as ns from './x.js';\nconst used = ns.foo;\nconst dead = 1;\nexport { used, dead };"
    expect(stripDeadExports(source, 'esm', keepOf('used'))?.code).toContain("import * as ns from './x.js';")
  })

  it('leaves a default import untouched while stripping a dead export', () => {
    const source = "import d from './x.js';\nconst used = d;\nconst dead = 1;\nexport { used, dead };"
    expect(stripDeadExports(source, 'esm', keepOf('used'))?.code).toContain("import d from './x.js';")
  })

  it('leaves a side-effect-only import untouched while stripping a dead export', () => {
    const source = "import './x.js';\nconst keepme = 1;\nconst dead = 2;\nexport { keepme, dead };"
    expect(stripDeadExports(source, 'esm', keepOf('keepme'))?.code).toContain("import './x.js';")
  })

  it('leaves a fully-used named import unchanged when a different export is stripped', () => {
    const source = "import { live } from './x.js';\nconst used = live;\nconst dead = 1;\nexport { used, dead };"
    expect(stripDeadExports(source, 'esm', keepOf('used'))?.code).toContain("import { live } from './x.js';")
  })

  it('keeps a cjs require still consumed by a surviving declaration', () => {
    const source =
      "'use strict';\nvar dep = require('./d/index.cjs.js');\nconst kept = dep.foo;\nconst dead = 1;\nexports.kept = kept;\nexports.dead = dead;"
    expect(stripDeadExports(source, 'cjs', keepOf('kept'))?.code).toContain('require')
  })

  it('retains an export whose initializer calls within a conditional', () => {
    expect(stripDeadExports('const a = cond ? f() : g();\nexport { a };', 'esm', keepOf())).toBeNull()
  })
})
