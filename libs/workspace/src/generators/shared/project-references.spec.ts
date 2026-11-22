import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { updateProjectReferences } from './project-references'
import { readJson } from './tree'

const FILES = {
  'libs/alpha/project.json': '{ "name": "alpha" }',
  'libs/beta/project.json':
    '{ "name": "beta", "implicitDependencies": ["alpha", "gamma"], "targets": { "build": { "dependsOn": ["alpha:build", "alpha:build:watch", "^build"] }, "test": {} } }',
  'libs/gamma/project.json': '{ "name": "gamma", "implicitDependencies": ["beta"] }',
  'libs/delta/project.json': '{ "name": "delta", "implicitDependencies": ["alpha"] }',
}

describe('updateProjectReferences', () => {
  it('renames the project in implicit dependencies and in the tasks of it that targets run after', () => {
    const tree = createMemoryTree(FILES)
    updateProjectReferences(tree, { currentProjectName: 'alpha', newProjectName: 'omega' })
    expect(readJson(tree, 'libs/beta/project.json')).toEqual({
      name: 'beta',
      implicitDependencies: ['omega', 'gamma'],
      targets: { build: { dependsOn: ['omega:build', 'omega:build:watch', '^build'] }, test: {} },
    })
  })

  it('leaves the tasks of a project whose name only starts with the renamed one, and a target of that name', () => {
    const tree = createMemoryTree({
      ...FILES,
      'libs/beta/project.json':
        '{ "name": "beta", "targets": { "alpha": {}, "build": { "dependsOn": ["alpha", "^alpha", "alpha-ui:build", "pre-alpha:build", { "target": "alpha" }] } } }',
    })
    updateProjectReferences(tree, { currentProjectName: 'alpha', newProjectName: 'omega' })
    expect(tree.listChanges().map((change) => change.path)).toEqual(['libs/delta/project.json'])
  })

  it('leaves a task that a command of a target names by hand as it is written', () => {
    const shell = '{ "name": "shell", "targets": { "start": { "options": { "command": "hf run alpha:build && node alpha:serve" } } } }'
    const tree = createMemoryTree({ ...FILES, 'apps/shell/project.json': shell })
    updateProjectReferences(tree, { currentProjectName: 'alpha', newProjectName: 'omega' })
    expect(tree.read('apps/shell/project.json', 'utf-8')).toBe(shell)
  })

  it('renames the project where the inputs of a target name it, alone or in a list', () => {
    const tree = createMemoryTree({
      ...FILES,
      'libs/beta/project.json':
        '{ "name": "beta", "targets": { "build": { "inputs": ["production", { "input": "production", "projects": "alpha" }, { "input": "code", "projects": ["alpha-ui", "alpha"] }, { "fileset": "{projectRoot}/alpha" }, { "input": "x", "projects": "alpha-ui" }] } } }',
    })
    updateProjectReferences(tree, { currentProjectName: 'alpha', newProjectName: 'omega' })
    expect(readJson(tree, 'libs/beta/project.json')).toEqual({
      name: 'beta',
      targets: {
        build: {
          inputs: [
            'production',
            { input: 'production', projects: 'omega' },
            { input: 'code', projects: ['alpha-ui', 'omega'] },
            { fileset: '{projectRoot}/alpha' },
            { input: 'x', projects: 'alpha-ui' },
          ],
        },
      },
    })
  })

  it('leaves the inputs that mean the project itself when the renamed project is called by that word', () => {
    const tree = createMemoryTree({
      'libs/self/project.json': '{ "name": "self" }',
      'libs/beta/project.json': '{ "name": "beta", "targets": { "build": { "inputs": [{ "input": "production", "projects": "self" }] } } }',
    })
    updateProjectReferences(tree, { currentProjectName: 'self', newProjectName: 'omega' })
    expect(tree.listChanges()).toEqual([])
  })

  it('renames the project in the defaults and the named inputs of the workspace file', () => {
    const tree = createMemoryTree({
      ...FILES,
      'hf.json':
        '{ "namedInputs": { "tooling": ["default", { "input": "production", "projects": "alpha" }] }, "targetDefaults": { "build": { "dependsOn": ["alpha:build", "^build"], "inputs": [{ "input": "tooling", "projects": ["alpha"] }] }, "lint": {} }, "lint": { "exclude": ["libs/alpha/**/*"] } }',
    })
    updateProjectReferences(tree, { currentProjectName: 'alpha', newProjectName: 'omega' })
    expect(readJson(tree, 'hf.json')).toEqual({
      namedInputs: { tooling: ['default', { input: 'production', projects: 'omega' }] },
      targetDefaults: { build: { dependsOn: ['omega:build', '^build'], inputs: [{ input: 'tooling', projects: ['omega'] }] }, lint: {} },
      lint: { exclude: ['libs/alpha/**/*'] },
    })
  })

  it('reads a workspace file that holds named inputs alone, passing over one that is no list', () => {
    const tree = createMemoryTree({
      ...FILES,
      'hf.json': '{ "namedInputs": { "odd": "alpha", "tooling": [{ "input": "production", "projects": "alpha" }] } }',
    })
    updateProjectReferences(tree, { currentProjectName: 'alpha', newProjectName: 'omega' })
    expect(readJson(tree, 'hf.json')).toEqual({ namedInputs: { odd: 'alpha', tooling: [{ input: 'production', projects: 'omega' }] } })
  })

  it('leaves a workspace file that does not name the project as it is written', () => {
    const tree = createMemoryTree({ ...FILES, 'hf.json': '{ "targetDefaults": { "build": {   "dependsOn": ["^build"] } } }' })
    updateProjectReferences(tree, { currentProjectName: 'alpha', newProjectName: 'omega' })
    expect(tree.listChanges().map((change) => change.path)).toEqual(['libs/beta/project.json', 'libs/delta/project.json'])
  })

  it('leaves a project that holds the name only where it is no reference as it is written', () => {
    const tree = createMemoryTree({
      'libs/alpha/project.json': '{ "name": "alpha" }',
      'libs/prose/project.json': '{ "name": "prose",   "description": "Reads alpha", "tags": ["alpha",\n"x"] }',
    })
    updateProjectReferences(tree, { currentProjectName: 'alpha', newProjectName: 'omega' })
    expect(tree.listChanges()).toEqual([])
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
