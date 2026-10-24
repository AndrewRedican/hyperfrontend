import { existsSync } from 'node:fs'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createProjectTrees } from './__test-utils__/project-trees.ts'
import rule from './lib-project-version-targets.ts'

const projects = createProjectTrees()
const PUBLISHABLE = projects.file('publishable', 'project.json')
const MISSING_VERSION = 'Publishable library must have "version" target for automated versioning. Add: "version": {} to targets.'
const MISSING_VERSION_CHECK = 'Publishable library must have "version-check" target for CI validation. Add: "version-check": {} to targets.'

testRule(rule, {
  valid: [
    { name: 'both targets', path: PUBLISHABLE, text: '{ "targets": { "version": {}, "version-check": {}, "build": {}, "publish": {} } }' },
  ],
  invalid: [
    {
      name: 'targets without version-check, on the targets property',
      path: PUBLISHABLE,
      text: '{\n  "targets": { "version": {} }\n}\n',
      errors: [{ message: MISSING_VERSION_CHECK, line: 2, column: 3, endLine: 2, endColumn: 31 }],
    },
    {
      name: 'targets without version',
      path: PUBLISHABLE,
      text: '{ "targets": { "version-check": {} } }',
      errors: [{ message: MISSING_VERSION, line: 1, column: 3 }],
    },
    {
      name: 'no targets at all, on the whole document',
      path: PUBLISHABLE,
      text: '{}',
      errors: [
        { message: MISSING_VERSION, line: 1, column: 1, endLine: 1, endColumn: 3 },
        { message: MISSING_VERSION_CHECK, line: 1, column: 1, endLine: 1, endColumn: 3 },
      ],
    },
    {
      name: 'targets that are no object',
      path: PUBLISHABLE,
      text: '{ "targets": [] }',
      errors: [
        { message: MISSING_VERSION, line: 1, column: 3 },
        { message: MISSING_VERSION_CHECK, line: 1, column: 3 },
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
