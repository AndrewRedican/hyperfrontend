import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { WORKSPACE_ROOT } from '../../runtime/aliases.ts'
import { createProjectTrees } from './__test-utils__/project-trees.ts'
import rule from './lib-e2e-project-required.ts'

const projects = createProjectTrees()
const LOGGING = join(WORKSPACE_ROOT, 'libs', 'logging', 'project.json')

testRule(rule, {
  valid: [
    { name: 'a library whose e2e project exists', path: LOGGING, text: '{ "name": "lib-logging" }' },
    {
      name: 'a library outside libs',
      path: projects.file('publishable', 'project.json'),
      text: '{ "name": "lib-nope" }',
    },
    { name: 'a project file without a name', path: LOGGING, text: '{}' },
    { name: 'a project file whose name is no string', path: LOGGING, text: '{ "name": 1 }' },
  ],
  invalid: [
    {
      name: 'a library without an e2e project',
      path: LOGGING,
      text: '{ "name": "lib-nope" }',
      errors: [
        {
          message: "Publishable library 'lib-nope' is missing a corresponding e2e project. Expected: apps/package-e2e/nope/project.json",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 23,
        },
      ],
    },
    {
      name: 'a library whose name lacks the prefix',
      path: LOGGING,
      text: '{ "name": "nope" }',
      errors: [
        {
          message: "Publishable library 'nope' is missing a corresponding e2e project. Expected: apps/package-e2e/nope/project.json",
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
