import { join } from 'node:path'
import { testRule } from '../../testing/rule-tester.ts'
import rule from './lib-pkg-exports-entry-shape.ts'

const PUBLISHABLE = join(import.meta.dirname, '__fixtures__', 'publishable', 'package.json')
const message = (path: string): string =>
  `Export path '${path}' is not an entry module. Point it at './src/index.<ext>' or './src/<dir>/index.<ext>': the build discovers entries only there, and fails on a subpath mapped anywhere else.`

testRule(rule, {
  valid: [
    {
      name: 'entry modules at the root and nested',
      path: PUBLISHABLE,
      text: '{ "exports": { ".": "./src/index.js", "./queue": "./src/lib/queue/index.js", "./types": "./src/index.d.ts" } }',
    },
    {
      name: 'the self reference and a bare specifier',
      path: PUBLISHABLE,
      text: '{ "exports": { "./package.json": "./package.json", "./x": "other" } }',
    },
    { name: 'no exports', path: PUBLISHABLE, text: '{}' },
  ],
  invalid: [
    {
      name: 'a file module under src',
      path: PUBLISHABLE,
      text: '{ "exports": { "./utils": "./src/utils.js" } }',
      errors: [{ message: message('./src/utils.js'), line: 1, column: 27, endLine: 1, endColumn: 43 }],
    },
    {
      name: 'a path outside src, a parent path and an index without an extension',
      path: PUBLISHABLE,
      text: '{ "exports": { "./a": "./dist/index.js", "./b": "../x/src/index.js", "./c": "./src/index" } }',
      errors: [
        { message: message('./dist/index.js'), line: 1, column: 23 },
        { message: message('../x/src/index.js'), line: 1, column: 49 },
        { message: message('./src/index'), line: 1, column: 77 },
      ],
    },
  ],
})
