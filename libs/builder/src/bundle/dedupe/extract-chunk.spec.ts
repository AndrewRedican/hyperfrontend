import type { OwnerIndex } from './attribute-modules'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { parseEntry } from './attribute-modules'
import { renderChunk, resolveModuleRefs } from './extract-chunk'

const ownersOf = (entries: Array<[string, string]>): OwnerIndex => {
  const ownerOf = createMap<string, string>()
  for (const [name, moduleKey] of entries) ownerOf.set(name, moduleKey)
  return { ownerOf }
}

const declsOf = (source: string, format: 'esm' | 'cjs' = 'esm'): ReturnType<typeof parseEntry>['decls'] => parseEntry(source, format).decls

const resolve = (
  moduleSource: string,
  owners: OwnerIndex,
  self: string,
  entrySource = moduleSource
): ReturnType<typeof resolveModuleRefs> => {
  const moduleParsed = parseEntry(moduleSource, 'esm')
  const entry = parseEntry(entrySource, 'esm')
  return resolveModuleRefs(moduleParsed.decls, owners, entry.importBindings, entry.declNames, self)
}

describe('resolveModuleRefs', () => {
  it('ignores references the module declares itself', () => {
    expect(resolve('const a = 1;\nconst b = a;', ownersOf([]), 'me').crossModule).toEqual([])
  })

  it('records a reference into another first-party module', () => {
    expect(resolve('const a = () => OTHER;', ownersOf([['OTHER', 'other']]), 'me').crossModule).toEqual([
      { ref: 'OTHER', base: 'OTHER', moduleKey: 'other' },
    ])
  })

  it('aliases a collision-renamed cross-module reference to its base name', () => {
    expect(resolve('const a = () => Store$1;', ownersOf([['Store', 'store']]), 'me').crossModule).toEqual([
      { ref: 'Store$1', base: 'Store', moduleKey: 'store' },
    ])
  })

  it('skips a reference owned by the module itself', () => {
    expect(resolve('const a = () => mine;', ownersOf([['mine', 'me']]), 'me').crossModule).toEqual([])
  })

  it('records a dependency import the entry carries', () => {
    expect(
      resolve(
        'const a = () => tag();',
        ownersOf([['a', 'me']]),
        'me',
        "import { tag } from './_dependencies/d/index.esm.js';\nconst a = () => tag();"
      ).depImports
    ).toEqual([{ ref: 'tag', binding: { specifier: './_dependencies/d/index.esm.js', kind: 'named', imported: 'tag' } }])
  })

  it('flags an inlined, unattributable top-level binding as unresolved', () => {
    expect(
      resolve('const a = () => helper;', ownersOf([['a', 'me']]), 'me', 'const helper = 1;\nconst a = () => helper;').unresolved
    ).toEqual(['helper'])
  })

  it('treats an unknown identifier as a runtime global', () => {
    expect(resolve('const a = () => Promise.resolve();', ownersOf([['a', 'me']]), 'me')).toEqual({
      crossModule: [],
      depImports: [],
      unresolved: [],
    })
  })
})

describe('renderChunk', () => {
  it('emits an ESM chunk with no imports as body plus export surface', () => {
    expect(renderChunk({ decls: declsOf('const a = 1;'), crossImports: [], depImports: [] }, 'esm')).toBe('const a = 1;\n\nexport { a };\n')
  })

  it('aliases an ESM export when the local name was collision-renamed', () => {
    expect(renderChunk({ decls: declsOf('const a$1 = 1;'), crossImports: [], depImports: [] }, 'esm')).toContain('export { a$1 as a };')
  })

  it('groups cross-module ESM imports from the same chunk into one statement', () => {
    const plan = {
      decls: declsOf('const z = 1;'),
      crossImports: [
        { ref: 'A', exported: 'A', specifier: './s.js' },
        { ref: 'B', exported: 'B', specifier: './s.js' },
      ],
      depImports: [],
    }
    expect(renderChunk(plan, 'esm')).toContain("import { A, B } from './s.js';")
  })

  it('sorts cross-module imports by specifier', () => {
    const plan = {
      decls: declsOf('const z = 1;'),
      crossImports: [
        { ref: 'C', exported: 'C', specifier: './c.js' },
        { ref: 'A', exported: 'A', specifier: './a.js' },
        { ref: 'B', exported: 'B', specifier: './b.js' },
      ],
      depImports: [],
    }
    expect(renderChunk(plan, 'esm').indexOf("'./a.js'")).toBeLessThan(renderChunk(plan, 'esm').indexOf("'./c.js'"))
  })

  it('renders an unaliased ESM named dependency import', () => {
    const plan = {
      decls: declsOf('const z = 1;'),
      crossImports: [],
      depImports: [{ ref: 'tag', kind: 'named' as const, imported: 'tag', specifier: './d.js' }],
    }
    expect(renderChunk(plan, 'esm')).toContain("import { tag } from './d.js';")
  })

  it('falls back to the local name when a named ESM dependency import omits the imported name', () => {
    const plan = {
      decls: declsOf('const z = 1;'),
      crossImports: [],
      depImports: [{ ref: 'tag', kind: 'named' as const, specifier: './d.js' }],
    }
    expect(renderChunk(plan, 'esm')).toContain("import { tag } from './d.js';")
  })

  it('falls back to the local name when a CJS named require omits the imported name', () => {
    const plan = {
      decls: declsOf("'use strict';\nconst z = 1;", 'cjs'),
      crossImports: [],
      depImports: [{ ref: 'tag', kind: 'cjs-named' as const, specifier: './d.js' }],
    }
    expect(renderChunk(plan, 'cjs')).toContain("const { tag } = require('./d.js');")
  })

  it('renders an aliased ESM cross-module import binding', () => {
    const plan = {
      decls: declsOf('const z = 1;'),
      crossImports: [{ ref: 'Store$1', exported: 'Store', specifier: './s.js' }],
      depImports: [],
    }
    expect(renderChunk(plan, 'esm')).toContain("import { Store as Store$1 } from './s.js';")
  })

  it('renders an ESM namespace dependency import', () => {
    const plan = {
      decls: declsOf('const z = 1;'),
      crossImports: [],
      depImports: [{ ref: 'ns', kind: 'namespace' as const, specifier: './d.js' }],
    }
    expect(renderChunk(plan, 'esm')).toContain("import * as ns from './d.js';")
  })

  it('renders an ESM default dependency import', () => {
    const plan = {
      decls: declsOf('const z = 1;'),
      crossImports: [],
      depImports: [{ ref: 'd', kind: 'default' as const, specifier: './d.js' }],
    }
    expect(renderChunk(plan, 'esm')).toContain("import d from './d.js';")
  })

  it('renders an aliased ESM named dependency import', () => {
    const plan = {
      decls: declsOf('const z = 1;'),
      crossImports: [],
      depImports: [{ ref: 'x', kind: 'named' as const, imported: 'tag', specifier: './d.js' }],
    }
    expect(renderChunk(plan, 'esm')).toContain("import { tag as x } from './d.js';")
  })

  it('emits a CJS chunk with a use-strict prologue and assignment exports', () => {
    expect(renderChunk({ decls: declsOf("'use strict';\nconst a = 1;", 'cjs'), crossImports: [], depImports: [] }, 'cjs')).toBe(
      "'use strict';\n\nconst a = 1;\n\nexports.a = a;\n"
    )
  })

  it('renders a CJS cross-module destructuring require', () => {
    const plan = {
      decls: declsOf("'use strict';\nconst z = 1;", 'cjs'),
      crossImports: [{ ref: 'A', exported: 'A', specifier: './s.js' }],
      depImports: [],
    }
    expect(renderChunk(plan, 'cjs')).toContain("const { A } = require('./s.js');")
  })

  it('renders a CJS namespace require for a dependency binding', () => {
    const plan = {
      decls: declsOf("'use strict';\nconst z = 1;", 'cjs'),
      crossImports: [],
      depImports: [{ ref: 'dep', kind: 'cjs-namespace' as const, specifier: './d.js' }],
    }
    expect(renderChunk(plan, 'cjs')).toContain("const dep = require('./d.js');")
  })

  it('renders an aliased CJS named require for a dependency binding', () => {
    const plan = {
      decls: declsOf("'use strict';\nconst z = 1;", 'cjs'),
      crossImports: [],
      depImports: [{ ref: 'x', kind: 'cjs-named' as const, imported: 'tag', specifier: './d.js' }],
    }
    expect(renderChunk(plan, 'cjs')).toContain("const { tag: x } = require('./d.js');")
  })
})
