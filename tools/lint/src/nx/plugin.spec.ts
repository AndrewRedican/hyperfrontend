import { describe, expect, it } from '@hyperfrontend/testing'
import { createNodesV2, lintTarget } from './plugin.ts'

const [pattern, infer] = createNodesV2

describe('createNodesV2', () => {
  it('reads every project file', () => {
    expect(pattern).toBe('**/{project.json,package.json}')
  })

  it('gives each project but the workspace root a lint target', () => {
    expect(infer(['project.json', 'libs/a/project.json'], undefined, { workspaceRoot: '/w' })).toEqual([
      ['project.json', {}],
      ['libs/a/project.json', { projects: { 'libs/a': { targets: { lint: lintTarget('libs/a') } } } }],
    ])
  })
})

describe('lintTarget', () => {
  it('runs the linter from the project root', () => {
    expect(lintTarget('libs/utils/a')).toEqual({
      command: 'node ../../../tools/lint/bin/lint.ts .',
      options: { cwd: 'libs/utils/a' },
      metadata: { technologies: ['lint'], description: 'Runs the workspace linter on the project.' },
    })
  })
})
