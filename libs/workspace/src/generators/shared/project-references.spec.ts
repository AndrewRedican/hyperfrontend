import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { updateProjectReferences } from './project-references'
import { readJson } from './tree'

const FILES = {
  'libs/alpha/project.json': '{ "name": "alpha" }',
  'libs/beta/project.json':
    '{ "name": "beta", "implicitDependencies": ["alpha", "gamma"], "targets": { "build": { "dependsOn": ["alpha", "^build"] }, "test": {} } }',
  'libs/gamma/project.json': '{ "name": "gamma", "implicitDependencies": ["beta"] }',
  'libs/delta/project.json': '{ "name": "delta", "implicitDependencies": ["alpha"] }',
}

describe('updateProjectReferences', () => {
  it('renames the project in implicit dependencies and in the targets that depend on it', () => {
    const tree = createMemoryTree(FILES)
    updateProjectReferences(tree, { currentProjectName: 'alpha', newProjectName: 'omega' })
    expect(readJson(tree, 'libs/beta/project.json')).toEqual({
      name: 'beta',
      implicitDependencies: ['omega', 'gamma'],
      targets: { build: { dependsOn: ['omega', '^build'] }, test: {} },
    })
  })

  it('leaves the projects that do not mention it, and the roots excluded, untouched', () => {
    const tree = createMemoryTree(FILES)
    updateProjectReferences(tree, { currentProjectName: 'alpha', newProjectName: 'omega', excludeRoots: ['libs/delta'] })
    expect(tree.listChanges().map((change) => change.path)).toEqual(['libs/beta/project.json'])
  })

  it('changes nothing when the name stays', () => {
    const tree = createMemoryTree(FILES)
    updateProjectReferences(tree, { currentProjectName: 'alpha', newProjectName: 'alpha' })
    expect(tree.listChanges()).toEqual([])
  })
})
