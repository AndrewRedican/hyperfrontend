import { join } from 'node:path'
import { testRule } from '../../testing/rule-tester.ts'
import rule from './lib-pkg-package-json-export.ts'

const PUBLISHABLE = join(import.meta.dirname, '__fixtures__', 'publishable', 'package.json')
const MESSAGE =
  'Publishable library package.json must export "./package.json" for tool compatibility. Add: "./package.json": "./package.json"'

testRule(rule, {
  valid: [
    {
      name: 'exports with the self reference',
      path: PUBLISHABLE,
      text: '{ "exports": { ".": "./src/index.js", "./package.json": "./package.json" } }',
    },
  ],
  invalid: [
    {
      name: 'exports without the self reference, on the exports property',
      path: PUBLISHABLE,
      text: '{\n  "exports": { ".": "./src/index.js" }\n}\n',
      errors: [{ message: MESSAGE, line: 2, column: 3, endLine: 2, endColumn: 39 }],
    },
    {
      name: 'exports that are no object',
      path: PUBLISHABLE,
      text: '{ "exports": "./src/index.js" }',
      errors: [{ message: MESSAGE, line: 1, column: 3 }],
    },
    {
      name: 'no exports at all, at the start of the file without a range',
      path: PUBLISHABLE,
      text: '{ "name": "x" }',
      errors: [{ message: MESSAGE, line: 1, column: 1, endLine: null, endColumn: null }],
    },
  ],
})
