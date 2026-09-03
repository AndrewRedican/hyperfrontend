import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { describe, expect, it } from '@hyperfrontend/testing'
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

// context: models the real `error` chunk shape — a `_freeze` alias, distinct `_TypeError`-style global captures, eight factory arrows that close over them, one frozen `Error` namespace aggregating all eight, and a single `export { … }` list.
const errorChunkDecls = [
  'const _freeze = globalThis.Object.freeze;',
  'const _Error = globalThis.Error;',
  'const _TypeError = globalThis.TypeError;',
  'const _RangeError = globalThis.RangeError;',
  'const _SyntaxError = globalThis.SyntaxError;',
  'const _ReferenceError = globalThis.ReferenceError;',
  'const _EvalError = globalThis.EvalError;',
  'const _URIError = globalThis.URIError;',
  'const _AggregateError = globalThis.AggregateError;',
  'const createError = (msg) => new _Error(msg);',
  'const createTypeError = (msg) => new _TypeError(msg);',
  'const createRangeError = (msg) => new _RangeError(msg);',
  'const createSyntaxError = (msg) => new _SyntaxError(msg);',
  'const createReferenceError = (msg) => new _ReferenceError(msg);',
  'const createEvalError = (msg) => new _EvalError(msg);',
  'const createUriError = (msg) => new _URIError(msg);',
  'const createAggregateError = (msg) => new _AggregateError(msg);',
  'const Error = _freeze({ createError, createTypeError, createRangeError, createSyntaxError, createReferenceError, createEvalError, createUriError, createAggregateError });',
]
const errorFactoryNames = [
  'createError',
  'createTypeError',
  'createRangeError',
  'createSyntaxError',
  'createReferenceError',
  'createEvalError',
  'createUriError',
  'createAggregateError',
]
const errorChunkEsm = [...errorChunkDecls, `export { ${errorFactoryNames.join(', ')}, Error };`].join('\n')
const errorChunkCjs = [
  "'use strict';",
  ...errorChunkDecls,
  ...errorFactoryNames.map((name) => `exports.${name} = ${name};`),
  'exports.Error = Error;',
].join('\n')

// context: models the real `math` chunk shape — a `_freeze` alias, a `_Math` global capture, member consts read off it, and a frozen `Math` namespace aggregating them.
const mathChunkDecls = [
  'const _freeze = globalThis.Object.freeze;',
  'const _Math = globalThis.Math;',
  'const abs = _Math.abs;',
  'const random = _Math.random;',
  'const round = _Math.round;',
  'const floor = _Math.floor;',
  'const ceil = _Math.ceil;',
  'const Math = _freeze({ abs, random, round, floor, ceil });',
]
const mathChunkEsm = [...mathChunkDecls, 'export { abs, random, round, floor, ceil, Math };'].join('\n')

describe('stripDeadExports namespace collapse', () => {
  it('collapses the error namespace to the single demanded factory (esm)', () => {
    const result = stripDeadExports(errorChunkEsm, 'esm', keepOf('createError'))
    expect(result?.code).toContain('export { createError };')
    expect(result?.code).toContain('const createError = (msg) => new _Error(msg);')
    // why: the freeze call is the only consumer of the namespace; its disappearance proves the aggregator and `_freeze` cascaded out.
    expect(result?.code).not.toContain('_freeze')
    expect(result?.code).not.toContain('createTypeError')
    expect(result?.code).not.toContain('_TypeError')
    expect(result?.removedNames.sort()).toEqual(['Error', ...errorFactoryNames.slice(1)].sort())
  })

  it('collapses the error namespace to the single demanded factory (cjs)', () => {
    const result = stripDeadExports(errorChunkCjs, 'cjs', keepOf('createError'))
    expect(result?.code).toContain('exports.createError = createError;')
    expect(result?.code).not.toContain('exports.Error')
    expect(result?.code).not.toContain('exports.createTypeError')
    expect(result?.code).not.toContain('_freeze')
    expect(result?.removedNames.sort()).toEqual(['Error', ...errorFactoryNames.slice(1)].sort())
  })

  it('keeps the whole namespace and every factory it names when an importer demands it', () => {
    // why: a hypothetical namespace importer (`keep` includes `Error`) must never over-strip — the frozen object reaches every factory and capture.
    expect(stripDeadExports(errorChunkEsm, 'esm', keepOf('createError', 'Error'))).toBeNull()
  })

  it('collapses the math namespace to the demanded members and drops the now-dead freeze (esm)', () => {
    const result = stripDeadExports(mathChunkEsm, 'esm', keepOf('abs', 'random', 'round'))
    expect(result?.code).toContain('export { abs, random, round };')
    // why: `_Math` is still read by the three surviving members, so the shared capture must stay.
    expect(result?.code).toContain('const _Math = globalThis.Math;')
    expect(result?.code).not.toContain('const floor')
    expect(result?.code).not.toContain('const ceil')
    // why: the last freeze call vanishes with the namespace, so `_freeze` is unreferenced and removed.
    expect(result?.code).not.toContain('_freeze')
    expect(result?.removedNames.sort()).toEqual(['Math', 'ceil', 'floor'])
  })
})
