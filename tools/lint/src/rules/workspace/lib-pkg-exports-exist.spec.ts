import { join } from 'node:path'
import { testRule } from '../../testing/rule-tester.ts'
import rule from './lib-pkg-exports-exist.ts'

const PUBLISHABLE = join(import.meta.dirname, '__fixtures__', 'publishable', 'package.json')

testRule(rule, {
  valid: [
    {
      name: 'a compiled path whose source exists',
      path: PUBLISHABLE,
      text: '{ "exports": { ".": "./src/index.js", "./sub": "./src/sub/index.js" } }',
    },
    {
      name: 'a file that exists as written',
      path: PUBLISHABLE,
      text: '{ "exports": { "./package.json": "./package.json", "./src": "./src/index.ts" } }',
    },
    {
      name: 'module and commonjs paths whose source exists',
      path: PUBLISHABLE,
      text: '{ "exports": { "./a": { "import": "./src/index.mjs", "require": "./src/index.cjs" } } }',
    },
    { name: 'a bare specifier', path: PUBLISHABLE, text: '{ "exports": { ".": "left-pad" } }' },
    { name: 'no exports', path: PUBLISHABLE, text: '{}' },
  ],
  invalid: [
    {
      name: 'a compiled path without a source',
      path: PUBLISHABLE,
      text: '{ "exports": { "./x": "./src/x/index.js" } }',
      errors: [
        {
          message: "Export path './src/x/index.js' does not exist. Ensure the file exists or remove the export entry.",
          line: 1,
          column: 23,
          endLine: 1,
          endColumn: 41,
        },
      ],
    },
    {
      name: 'a missing module path and a missing commonjs path',
      path: PUBLISHABLE,
      text: '{ "exports": { "./x": { "import": "./x.mjs", "require": "./x.cjs" } } }',
      errors: [
        { message: "Export path './x.mjs' does not exist. Ensure the file exists or remove the export entry.", line: 1, column: 35 },
        { message: "Export path './x.cjs' does not exist. Ensure the file exists or remove the export entry.", line: 1, column: 57 },
      ],
    },
    {
      name: 'a missing file of another extension',
      path: PUBLISHABLE,
      text: '{ "exports": { "./x": "./x.json" } }',
      errors: [
        { message: "Export path './x.json' does not exist. Ensure the file exists or remove the export entry.", line: 1, column: 23 },
      ],
    },
  ],
})
