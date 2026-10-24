import { existsSync } from 'node:fs'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createProjectTrees } from './__test-utils__/project-trees.ts'
import rule from './lib-project-metadata.ts'

const projects = createProjectTrees()
const PUBLISHABLE = projects.file('publishable', 'project.json')

testRule(rule, {
  valid: [
    { name: 'a complete project file', path: PUBLISHABLE, text: '{ "name": "lib-x", "description": "d", "tags": ["type:util"] }' },
    {
      name: 'a project file of an application',
      path: projects.file('application', 'project.json'),
      text: '{}',
    },
  ],
  invalid: [
    {
      name: 'a project file with nothing',
      path: PUBLISHABLE,
      text: '{}',
      errors: [
        { message: "Publishable library project.json is missing required field 'name'.", line: 1, column: 1 },
        {
          message:
            'Publishable library project.json is missing required field \'description\'. Add: "description": "Description of the library"',
          line: 1,
          column: 1,
        },
        {
          message: 'Publishable library project.json is missing required field \'tags\'. Add: "tags": ["type:util", "scope:public"]',
          line: 1,
          column: 1,
        },
      ],
    },
    {
      name: 'a name without the prefix',
      path: PUBLISHABLE,
      text: '{ "name": "x", "description": "d", "tags": ["a"] }',
      errors: [
        {
          message: 'Publishable library project.json \'name\' must start with \'lib-\' prefix. Example: "name": "lib-my-library"',
          line: 1,
          column: 1,
        },
      ],
    },
    {
      name: 'a name that is no string',
      path: PUBLISHABLE,
      text: '{ "name": 1, "description": "d", "tags": ["a"] }',
      errors: [
        {
          message: 'Publishable library project.json \'name\' must start with \'lib-\' prefix. Example: "name": "lib-my-library"',
          line: 1,
          column: 1,
        },
      ],
    },
    {
      name: 'empty tags, reported on the tags property',
      path: PUBLISHABLE,
      text: '{\n  "name": "lib-x",\n  "description": "d",\n  "tags": []\n}\n',
      errors: [
        {
          message: "Publishable library project.json 'tags' field must be a non-empty array.",
          line: 4,
          column: 3,
          endLine: 4,
          endColumn: 13,
        },
      ],
    },
    {
      name: 'tags that are no array',
      path: PUBLISHABLE,
      text: '{ "name": "lib-x", "description": "d", "tags": "a" }',
      errors: [{ message: "Publishable library project.json 'tags' field must be a non-empty array.", line: 1, column: 40 }],
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    projects.remove()
    expect(existsSync(projects.root)).toBe(false)
  })
})
