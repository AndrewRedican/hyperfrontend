import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import rule from './lib-pkg-bundle-entry.ts'

const BUNDLED = join(import.meta.dirname, '__fixtures__', 'bundled', 'package.json')
const message = (entry: string): string =>
  `Bundle entry '${entry}' specified in project.json is not found in package.json exports. Add the export: "${entry}": "./path/to/entry.js"`

testRule(rule, {
  valid: [
    {
      name: 'two bundles with the same entry, asked once',
      path: join(import.meta.dirname, '__fixtures__', 'bundled-same', 'package.json'),
      text: '{ "exports": { ".": "./src/index.js" } }',
    },
    {
      name: 'a bundle whose entry is empty, ignored',
      path: join(import.meta.dirname, '__fixtures__', 'bundled-empty', 'package.json'),
      text: '{ "exports": { ".": "./src/index.js" } }',
    },
    {
      name: 'exports that cover both bundle entries',
      path: BUNDLED,
      text: '{ "exports": { ".": "./src/index.js", "./browser": "./src/browser/index.js" } }',
    },
    { name: 'a library without bundles', path: join(import.meta.dirname, '__fixtures__', 'publishable', 'package.json'), text: '{}' },
  ],
  invalid: [
    {
      name: 'exports missing the umd entry, on the exports property',
      path: BUNDLED,
      text: '{\n  "exports": { ".": "./src/index.js" }\n}\n',
      errors: [{ message: message('./browser'), line: 2, column: 3, endLine: 2, endColumn: 39 }],
    },
    {
      name: 'no exports at all, at the start of the file',
      path: BUNDLED,
      text: '{ "name": "x" }',
      errors: [
        { message: message('.'), line: 1, column: 1, endLine: null, endColumn: null },
        { message: message('./browser'), line: 1, column: 1, endLine: null, endColumn: null },
      ],
    },
    {
      name: 'exports that are no object',
      path: BUNDLED,
      text: '{ "exports": "./src/index.js" }',
      errors: [
        { message: message('.'), line: 1, column: 3 },
        { message: message('./browser'), line: 1, column: 3 },
      ],
    },
  ],
})
