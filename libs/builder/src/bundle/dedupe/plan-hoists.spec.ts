import type { OwnerIndex } from './attribute-modules'
import type { EntryInput } from './plan-hoists'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { attribute, parseEntry } from './attribute-modules'
import { planHoists } from './plan-hoists'

const ownersOf = (entries: Array<[string, string]>): OwnerIndex => {
  const ownerOf = createMap<string, string>()
  for (const [name, moduleKey] of entries) ownerOf.set(name, moduleKey)
  return { ownerOf }
}

const entryOf = (source: string, owners: OwnerIndex, format: 'esm' | 'cjs' = 'esm'): EntryInput => {
  const parsed = parseEntry(source, format)
  return { parsed, byModule: attribute(parsed, owners) }
}

const GREET = ownersOf([['greet', 'greet/greet']])
const GREET_BASE = ownersOf([
  ['greet', 'greet/greet'],
  ['BASE', 'base/base'],
])

describe('planHoists', () => {
  it('hoists a module inlined identically into two entries', () => {
    const entries = [
      entryOf('const greet = () => 1;\nexport { greet };', GREET),
      entryOf('const greet = () => 1;\nexport { greet };', GREET),
    ]
    expect(planHoists(entries, GREET).has('greet/greet')).toBe(true)
  })

  it('leaves a module inlined into a single entry alone', () => {
    expect(planHoists([entryOf('const greet = () => 1;\nexport { greet };', GREET)], GREET).size).toBe(0)
  })

  it('bails a module whose copies are not byte-identical', () => {
    const entries = [
      entryOf('const greet = () => 1;\nexport { greet };', GREET),
      entryOf('const greet = () => 2;\nexport { greet };', GREET),
    ]
    expect(planHoists(entries, GREET).size).toBe(0)
  })

  it('bails a module entangled with a bare side-effecting statement', () => {
    const entries = [
      entryOf('const greet = () => 1;\nlog(greet);\nexport { greet };', GREET),
      entryOf('const greet = () => 1;\nexport { greet };', GREET),
    ]
    expect(planHoists(entries, GREET).size).toBe(0)
  })

  it('bails a module that references an inlined unattributable binding', () => {
    const source = 'const helper = 1;\nconst greet = () => helper;\nexport { greet };'
    expect(planHoists([entryOf(source, GREET), entryOf(source, GREET)], GREET).size).toBe(0)
  })

  it('bails both modules of a dependency cycle', () => {
    const owners = ownersOf([
      ['a', 'm1/m1'],
      ['b', 'm2/m2'],
    ])
    const source = 'const a = () => b;\nconst b = () => a;\nexport { a, b };'
    expect(planHoists([entryOf(source, owners), entryOf(source, owners)], owners).size).toBe(0)
  })

  it('removes a hoist whose cross-module dependency is not itself hoistable', () => {
    const entries = [
      entryOf('const BASE = 1;\nconst greet = () => BASE;\nexport { BASE, greet };', GREET_BASE),
      entryOf('const greet = () => BASE;\nexport { greet };', GREET_BASE),
    ]
    expect(planHoists(entries, GREET_BASE).has('greet/greet')).toBe(false)
  })

  it('keeps two interdependent modules when both are shared', () => {
    const source = 'const BASE = 1;\nconst greet = () => BASE;\nexport { BASE, greet };'
    expect([...planHoists([entryOf(source, GREET_BASE), entryOf(source, GREET_BASE)], GREET_BASE).keys()].sort()).toEqual([
      'base/base',
      'greet/greet',
    ])
  })

  it('hoists the union from the superset entry when one copy is a subset', () => {
    const owners = ownersOf([
      ['a', 'm/m'],
      ['b', 'm/m'],
    ])
    const entries = [entryOf('const a = 1;\nconst b = 2;\nexport { a, b };', owners), entryOf('const a = 1;\nexport { a };', owners)]
    expect(
      planHoists(entries, owners)
        .get('m/m')
        ?.decls.map((decl) => decl.base)
    ).toEqual(['a', 'b'])
  })

  it('adopts a later entry as canonical when it holds more declarations', () => {
    const owners = ownersOf([
      ['a', 'm/m'],
      ['b', 'm/m'],
    ])
    const entries = [entryOf('const a = 1;\nexport { a };', owners), entryOf('const a = 1;\nconst b = 2;\nexport { a, b };', owners)]
    expect(
      planHoists(entries, owners)
        .get('m/m')
        ?.decls.map((decl) => decl.base)
    ).toEqual(['a', 'b'])
  })

  it('bails when a copy reorders the canonical declarations', () => {
    const owners = ownersOf([
      ['a', 'm/m'],
      ['b', 'm/m'],
    ])
    const entries = [
      entryOf('const a = 1;\nconst b = 2;\nexport { a, b };', owners),
      entryOf('const b = 2;\nconst a = 1;\nexport { a, b };', owners),
    ]
    expect(planHoists(entries, owners).size).toBe(0)
  })

  it('hoists CJS copies that differ only by a dep-namespace local $N suffix', () => {
    const entries = [
      entryOf(
        "'use strict';\nvar dep_js$1 = require('./d.js');\nconst greet = (n) => dep_js$1.tag(n);\nexports.greet = greet;",
        GREET,
        'cjs'
      ),
      entryOf(
        "'use strict';\nvar dep_js$2 = require('./d.js');\nconst greet = (n) => dep_js$2.tag(n);\nexports.greet = greet;",
        GREET,
        'cjs'
      ),
    ]
    expect(planHoists(entries, GREET).has('greet/greet')).toBe(true)
  })

  it('bails CJS copies whose bodies diverge beyond the $N numbering', () => {
    const entries = [
      entryOf(
        "'use strict';\nvar dep_js$1 = require('./d.js');\nconst greet = (n) => dep_js$1.tag(n);\nexports.greet = greet;",
        GREET,
        'cjs'
      ),
      entryOf(
        "'use strict';\nvar dep_js$2 = require('./d.js');\nconst greet = (n) => dep_js$2.fmt(n);\nexports.greet = greet;",
        GREET,
        'cjs'
      ),
    ]
    expect(planHoists(entries, GREET).size).toBe(0)
  })

  it('bails when a copy names a declaration absent from the canonical superset', () => {
    const owners = ownersOf([
      ['a', 'm/m'],
      ['b', 'm/m'],
    ])
    const entries = [entryOf('const a = 1;\nexport { a };', owners), entryOf('const b = 2;\nexport { b };', owners)]
    expect(planHoists(entries, owners).size).toBe(0)
  })
})
