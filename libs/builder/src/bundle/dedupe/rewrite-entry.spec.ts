import { parseEntry } from './attribute-modules'
import { rewriteEntry } from './rewrite-entry'

const SHARED = './_shared/greet/greet/index.esm.js'
const SHARED_CJS = './_shared/greet/greet/index.cjs.js'

describe('rewriteEntry', () => {
  it('returns the source unchanged when there are no hoists', () => {
    const parsed = parseEntry('const a = 1;\nexport { a };\n', 'esm')
    expect(rewriteEntry(parsed, [], 'esm')).toBe('const a = 1;\nexport { a };\n')
  })

  it('splices the hoisted declaration out of the entry', () => {
    const parsed = parseEntry("import { tag } from './d.js';\nconst greet = (n) => tag(n);\nexport { greet };\n", 'esm')
    expect(rewriteEntry(parsed, [{ decls: parsed.decls, specifier: SHARED }], 'esm')).not.toContain('const greet =')
  })

  it('inserts the ESM import after the entry header', () => {
    const parsed = parseEntry("import { tag } from './d.js';\nconst greet = (n) => tag(n);\nexport { greet };\n", 'esm')
    expect(rewriteEntry(parsed, [{ decls: parsed.decls, specifier: SHARED }], 'esm')).toContain(
      "import { tag } from './d.js';\nimport { greet } from './_shared/greet/greet/index.esm.js';"
    )
  })

  it('aliases the ESM import when the entry local name was collision-renamed', () => {
    const parsed = parseEntry('const greet$1 = 1;\nexport { greet$1 as greet };\n', 'esm')
    expect(rewriteEntry(parsed, [{ decls: parsed.decls, specifier: SHARED }], 'esm')).toContain(
      `import { greet as greet$1 } from '${SHARED}';`
    )
  })

  it('prepends the import at the top when the entry has no header', () => {
    const parsed = parseEntry('const a = 1;\nexport { a };\n', 'esm')
    expect(rewriteEntry(parsed, [{ decls: parsed.decls, specifier: SHARED }], 'esm')).toBe(
      `import { a } from '${SHARED}';\n\nexport { a };\n`
    )
  })

  it('leaves the export surface untouched', () => {
    const parsed = parseEntry('const a = 1;\nexport { a };\n', 'esm')
    expect(rewriteEntry(parsed, [{ decls: parsed.decls, specifier: SHARED }], 'esm')).toContain('export { a };')
  })

  it('inserts a destructuring require for a CJS entry', () => {
    const parsed = parseEntry(
      "'use strict';\nvar dep = require('./d.js');\nconst greet = (n) => dep.tag(n);\nexports.greet = greet;\n",
      'cjs'
    )
    expect(rewriteEntry(parsed, [{ decls: parsed.decls, specifier: SHARED_CJS }], 'cjs')).toContain(
      `const { greet } = require('${SHARED_CJS}');`
    )
  })

  it('omits a hoisted private helper referenced only by another hoisted export', () => {
    const parsed = parseEntry('const handlers = {};\nconst rootReducer = (s) => handlers;\nexport { rootReducer };\n', 'esm')
    const rewritten = rewriteEntry(parsed, [{ decls: parsed.decls, specifier: SHARED }], 'esm')
    expect(rewritten).toContain('import { rootReducer }')
    expect(rewritten).not.toContain('handlers')
  })

  it('retains a hoisted private helper still referenced by surviving entry code', () => {
    const parsed = parseEntry(
      'const handlers = {};\nconst rootReducer = (s) => handlers;\nkeep(handlers);\nexport { rootReducer };\n',
      'esm'
    )
    const rewritten = rewriteEntry(parsed, [{ decls: parsed.decls, specifier: SHARED }], 'esm')
    expect(rewritten).toContain(`import { handlers, rootReducer } from '${SHARED}';`)
  })

  it('inserts no import when every hoisted declaration is dead after splicing', () => {
    const parsed = parseEntry('const dead = 1;\nfoo();\n', 'esm')
    const rewritten = rewriteEntry(parsed, [{ decls: parsed.decls, specifier: SHARED }], 'esm')
    expect(rewritten).not.toContain('import')
    expect(rewritten).toContain('foo();')
  })

  it('combines multiple hoisted modules into the inserted block', () => {
    const parsed = parseEntry('const a = 1;\nconst b = 2;\nexport { a, b };\n', 'esm')
    const rewritten = rewriteEntry(
      parsed,
      [
        { decls: [parsed.decls[0]], specifier: './_shared/a/index.esm.js' },
        { decls: [parsed.decls[1]], specifier: './_shared/b/index.esm.js' },
      ],
      'esm'
    )
    expect(rewritten).toContain("import { a } from './_shared/a/index.esm.js';\nimport { b } from './_shared/b/index.esm.js';")
  })
})
