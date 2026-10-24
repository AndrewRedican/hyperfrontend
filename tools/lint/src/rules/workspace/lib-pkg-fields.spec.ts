import { existsSync } from 'node:fs'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createProjectTrees } from './__test-utils__/project-trees.ts'
import rule from './lib-pkg-fields.ts'

const projects = createProjectTrees()
const PUBLISHABLE = projects.file('publishable', 'package.json')
const COMPLETE =
  '{\n  "name": "@hyperfrontend/x",\n  "description": "d",\n  "license": "MIT",\n  "sideEffects": false,\n  "engines": {},\n  "keywords": []\n}\n'

testRule(rule, {
  valid: [
    { name: 'a manifest with every field', path: PUBLISHABLE, text: COMPLETE },
    {
      name: 'a manifest of a project that is no publishable library',
      path: projects.file('plain', 'package.json'),
      text: '{}',
    },
  ],
  invalid: [
    {
      name: 'a manifest missing two fields, each over the whole document',
      path: PUBLISHABLE,
      text: '{\n  "name": "@hyperfrontend/x",\n  "license": "MIT",\n  "sideEffects": false,\n  "keywords": []\n}\n',
      errors: [
        {
          message:
            'Publishable library package.json is missing required field \'description\'. Add: "description": "Description of the library"',
          line: 1,
          column: 1,
          endLine: 7,
          endColumn: 1,
        },
        {
          message: 'Publishable library package.json is missing required field \'engines\'. Add: "engines": { "node": ">=18.0.0" }',
          line: 1,
          column: 1,
          endLine: 7,
          endColumn: 1,
        },
      ],
    },
    {
      name: 'an empty manifest, missing every field',
      path: PUBLISHABLE,
      text: '{}',
      errors: [
        {
          message: 'Publishable library package.json is missing required field \'name\'. Add: "name": "@hyperfrontend/my-lib"',
          line: 1,
          column: 1,
        },
        {
          message:
            'Publishable library package.json is missing required field \'description\'. Add: "description": "Description of the library"',
          line: 1,
          column: 1,
        },
        { message: 'Publishable library package.json is missing required field \'license\'. Add: "license": "MIT"', line: 1, column: 1 },
        {
          message: 'Publishable library package.json is missing required field \'sideEffects\'. Add: "sideEffects": false',
          line: 1,
          column: 1,
        },
        {
          message: 'Publishable library package.json is missing required field \'engines\'. Add: "engines": { "node": ">=18.0.0" }',
          line: 1,
          column: 1,
        },
        {
          message: 'Publishable library package.json is missing required field \'keywords\'. Add: "keywords": ["keyword1", "keyword2"]',
          line: 1,
          column: 1,
        },
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
