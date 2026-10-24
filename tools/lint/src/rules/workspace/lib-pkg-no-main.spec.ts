import { existsSync } from 'node:fs'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createProjectTrees } from './__test-utils__/project-trees.ts'
import rule from './lib-pkg-no-main.ts'

const projects = createProjectTrees()
const PUBLISHABLE = projects.file('publishable', 'package.json')
const PLAIN = projects.file('plain', 'package.json')
const CONVERT = 'Do not use "main" field in publishable libraries. Use "exports" field instead: "exports": { ".": "./src/index.js" }'
const REMOVE = 'Remove the "main" field. The "exports" field should be used instead for modern Node.js resolution.'

testRule(rule, {
  valid: [
    { name: 'a manifest with exports only', path: PUBLISHABLE, text: '{\n  "name": "x",\n  "exports": { ".": "./src/index.js" }\n}\n' },
    { name: 'a manifest of a project that is no publishable library', path: PLAIN, text: '{\n  "main": "./index.js"\n}\n' },
    {
      name: 'a file that is no manifest',
      path: projects.file('publishable', 'other.json'),
      text: '{ "main": "x" }',
    },
    { name: 'a document that is no object', path: PUBLISHABLE, text: '["main"]' },
  ],
  invalid: [
    {
      name: 'a main beside exports, removing it with its separator',
      path: PUBLISHABLE,
      text: '{\n  "name": "x",\n  "main": "./src/index.js",\n  "exports": { ".": "./src/index.js" },\n  "version": "1.0.0"\n}\n',
      errors: [{ message: REMOVE, line: 3, column: 3, endLine: 3, endColumn: 27 }],
      output: '{\n  "name": "x",\n  "exports": { ".": "./src/index.js" },\n  "version": "1.0.0"\n}\n',
    },
    {
      name: 'a main first in the object',
      path: PUBLISHABLE,
      text: '{\n  "main": "./src/index.js",\n  "exports": {}\n}\n',
      errors: [{ message: REMOVE, line: 2, column: 3 }],
      output: '{\n  "exports": {}\n}\n',
    },
    {
      name: 'a main alone, converted to exports',
      path: PUBLISHABLE,
      text: '{\n  "name": "x",\n  "main": "./src/index.js",\n  "description": "x"\n}\n',
      errors: [{ message: CONVERT, line: 3, column: 3, endLine: 3, endColumn: 27 }],
      output: '{\n  "name": "x",\n  "exports": {\n    ".": "./src/index.js"\n  },\n  "description": "x"\n}\n',
    },
    {
      name: 'a main that is no string',
      path: PUBLISHABLE,
      text: '{ "main": 1 }',
      errors: [{ message: CONVERT, line: 1, column: 3 }],
      output: '{ "exports": {\n   ".": "./src/index.js"\n } }',
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    projects.remove()
    expect(existsSync(projects.root)).toBe(false)
  })
})
