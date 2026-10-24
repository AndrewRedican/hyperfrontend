import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import rule from './no-barrel-star-export.ts'

// why: every recorded case names a file in a temporary workspace; the hermetic cases below cover the same behaviours.
testRule(rule, { valid: [], invalid: [] })

// why: the rule reads the project and manifest above the file, so the fixture is a disposable workspace in the temporary directory.
const DIR = createTempDir({ prefix: 'lint-barrel-' })
const ROOT = DIR.path
const PUBLISHABLE = '{ "name": "lib", "projectType": "library", "targets": { "build": {}, "publish": {} } }'
DIR.write('pub/project.json', PUBLISHABLE)
DIR.write(
  'pub/package.json',
  '{ "name": "@s/pub", "exports": { ".": "./src/index.js", "./models": { "import": "./src/models/index.mjs" }, "./cjs": { "require": "./src/cjs/index.cjs" }, "./default": { "default": "./src/default/index.js" }, "./unknown": { "types": "./src/unknown/index.d.ts" }, "./number": 1 } }'
)
DIR.write('string/project.json', PUBLISHABLE)
DIR.write('string/package.json', '{ "name": "@s/string", "exports": "./src/index.js" }')
DIR.write('array/project.json', PUBLISHABLE)
DIR.write('array/package.json', '{ "name": "@s/array", "exports": 7 }')
DIR.write('internal/project.json', '{ "name": "internal", "projectType": "library", "targets": { "build": {} } }')
DIR.write('internal/package.json', '{ "name": "@s/internal", "exports": "./src/index.js" }')
DIR.write('nomanifest/project.json', PUBLISHABLE)

const star = (source: string): string =>
  `Star exports (\`export * from "${source}"\`) are not allowed in entry point files. Use explicit named exports instead: \`export { name1, name2 } from "${source}"\`.`
const typeStar = (source: string): string =>
  `Star type exports (\`export type * from "${source}"\`) are not allowed in entry point files. Use explicit named exports instead: \`export type { Type1, Type2 } from "${source}"\`.`
const CODE = "export * from './foo'\n"

testRule(rule, {
  valid: [
    { name: 'a file that is no index', path: join(ROOT, 'pub', 'src', 'exports.ts'), root: join(ROOT, 'pub'), text: CODE },
    {
      name: 'an index of a library that does not publish',
      path: join(ROOT, 'internal', 'src', 'index.ts'),
      root: join(ROOT, 'internal'),
      text: CODE,
    },
    {
      name: 'an index the exports map does not name',
      path: join(ROOT, 'pub', 'src', 'internal', 'index.ts'),
      root: join(ROOT, 'pub'),
      text: CODE,
    },
    {
      name: 'an index under unrecognised conditions',
      path: join(ROOT, 'pub', 'src', 'unknown', 'index.ts'),
      root: join(ROOT, 'pub'),
      text: CODE,
    },
    { name: 'a project without a manifest', path: join(ROOT, 'nomanifest', 'src', 'index.ts'), root: join(ROOT, 'nomanifest'), text: CODE },
    { name: 'a manifest whose exports are no map', path: join(ROOT, 'array', 'src', 'index.ts'), root: join(ROOT, 'array'), text: CODE },
    { name: 'an index outside any project', path: join(ROOT, 'plain', 'index.ts'), root: join(ROOT, 'plain'), text: CODE },
    {
      name: 'named exports in an entry',
      path: join(ROOT, 'pub', 'src', 'index.ts'),
      root: join(ROOT, 'pub'),
      text: "export { a } from './a'\nexport type { B } from './b'\nexport const c = 1\n",
    },
  ],
  invalid: [
    {
      name: 'star exports in the main entry',
      path: join(ROOT, 'pub', 'src', 'index.ts'),
      root: join(ROOT, 'pub'),
      text: "export { a } from './a'\nexport * from './foo'\nexport type * from './types'\nexport * as ns from './ns'\n",
      errors: [
        { message: star('./foo'), line: 2, column: 1, endLine: 2, endColumn: 22 },
        { message: typeStar('./types'), line: 3, column: 1, endLine: 3, endColumn: 29 },
        { message: star('./ns'), line: 4, column: 1, endLine: 4, endColumn: 27 },
      ],
    },
    {
      name: 'a star export in an entry mapped through an import condition',
      path: join(ROOT, 'pub', 'src', 'models', 'index.ts'),
      root: join(ROOT, 'pub'),
      text: CODE,
      errors: [{ message: star('./foo'), line: 1, column: 1, endLine: 1, endColumn: 22 }],
    },
    {
      name: 'a star export in an entry mapped through a require condition',
      path: join(ROOT, 'pub', 'src', 'cjs', 'index.ts'),
      root: join(ROOT, 'pub'),
      text: CODE,
      errors: [{ message: star('./foo'), line: 1, column: 1, endLine: 1, endColumn: 22 }],
    },
    {
      name: 'a star export in an entry mapped through a default condition',
      path: join(ROOT, 'pub', 'src', 'default', 'index.ts'),
      root: join(ROOT, 'pub'),
      text: CODE,
      errors: [{ message: star('./foo'), line: 1, column: 1, endLine: 1, endColumn: 22 }],
    },
    {
      name: 'a star export in the entry of a string exports field',
      path: join(ROOT, 'string', 'src', 'index.ts'),
      root: join(ROOT, 'string'),
      text: CODE,
      errors: [{ message: star('./foo'), line: 1, column: 1, endLine: 1, endColumn: 22 }],
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    DIR.remove()
    expect(existsSync(ROOT)).toBe(false)
  })
})
