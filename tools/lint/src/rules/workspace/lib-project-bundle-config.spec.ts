import { join } from 'node:path'
import { testRule } from '../../testing/rule-tester.ts'
import rule from './lib-project-bundle-config.ts'

const PUBLISHABLE = join(import.meta.dirname, '__fixtures__', 'publishable', 'project.json')
const file = (options: string): string => `{\n  "targets": { "build": { "options": ${options} }, "publish": {} }\n}\n`
const MISSING_ENTRY = (format: string): string =>
  `Bundled output '${format}' is missing required field 'entry'. Bundled outputs must specify their entry point.`
const MISSING_GLOBAL = (format: string): string =>
  `Bundled output '${format}' is missing required field 'globalName'. Bundled outputs must specify a global variable name for browser consumption.`

testRule(rule, {
  valid: [
    {
      name: 'complete bundles',
      path: PUBLISHABLE,
      text: file('{ "iife": { "entry": ".", "globalName": "X" }, "umd": { "entry": ".", "globalName": "X" } }'),
    },
    { name: 'no bundles', path: PUBLISHABLE, text: file('{ "esm": {} }') },
    { name: 'no build options', path: PUBLISHABLE, text: '{ "targets": { "build": {}, "publish": {} } }' },
    { name: 'no targets', path: PUBLISHABLE, text: '{}' },
    {
      name: 'a project that is no publishable library',
      path: join(import.meta.dirname, '__fixtures__', 'application', 'project.json'),
      text: file('{ "iife": {} }'),
    },
    { name: 'bundles declared as a list, left to the build', path: PUBLISHABLE, text: file('{ "iife": [{ "entry": "." }], "umd": true }') },
  ],
  invalid: [
    {
      name: 'a bundle anywhere in the document with an empty entry',
      path: PUBLISHABLE,
      text: '{ "x": { "iife": { "entry": "", "globalName": "X" } } }',
      errors: [{ message: MISSING_ENTRY('iife'), line: 1, column: 10 }],
    },
    {
      name: 'a bundle whose global name is no string',
      path: PUBLISHABLE,
      text: file('{ "umd": { "entry": ".", "globalName": 1 } }'),
      errors: [{ message: MISSING_GLOBAL('umd'), line: 2, column: 40 }],
    },
    {
      name: 'a umd bundle without a global name, on the umd property',
      path: PUBLISHABLE,
      text: file('{ "iife": { "entry": ".", "globalName": "X" }, "umd": { "entry": "." } }'),
      errors: [{ message: MISSING_GLOBAL('umd'), line: 2, column: 85, endLine: 2, endColumn: 108 }],
    },
    {
      name: 'an iife bundle without an entry',
      path: PUBLISHABLE,
      text: file('{ "iife": { "globalName": "X" } }'),
      errors: [{ message: MISSING_ENTRY('iife'), line: 2, column: 40 }],
    },
  ],
})
