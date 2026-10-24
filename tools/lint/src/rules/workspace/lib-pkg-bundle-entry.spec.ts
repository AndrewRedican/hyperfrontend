import { existsSync } from 'node:fs'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createProjectTrees } from './__test-utils__/project-trees.ts'
import rule from './lib-pkg-bundle-entry.ts'

const projects = createProjectTrees()
const BUNDLED = projects.file('bundled', 'package.json')
const message = (entry: string): string =>
  `Bundle entry '${entry}' specified in project.json is not found in package.json exports. Add the export: "${entry}": "./path/to/entry.js"`

testRule(rule, {
  valid: [
    {
      name: 'two bundles with the same entry, asked once',
      path: projects.file('bundled-same', 'package.json'),
      text: '{ "exports": { ".": "./src/index.js" } }',
    },
    {
      name: 'a bundle whose entry is empty, ignored',
      path: projects.file('bundled-empty', 'package.json'),
      text: '{ "exports": { ".": "./src/index.js" } }',
    },
    {
      name: 'exports that cover both bundle entries',
      path: BUNDLED,
      text: '{ "exports": { ".": "./src/index.js", "./browser": "./src/browser/index.js" } }',
    },
    { name: 'a library without bundles', path: projects.file('publishable', 'package.json'), text: '{}' },
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

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    projects.remove()
    expect(existsSync(projects.root)).toBe(false)
  })
})
