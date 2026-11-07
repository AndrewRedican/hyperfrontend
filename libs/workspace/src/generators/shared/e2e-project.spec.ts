import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { e2eProjectOf, renameE2eProject } from './e2e-project'
import { readJson } from './tree'

const FILES = {
  'libs/a/project.json': '{ "name": "lib-a" }',
  'libs/b/project.json': '{ "name": "lib-b", "implicitDependencies": ["lib-a"] }',
  'e2e/a/project.json':
    '{ "name": "e2e-lib-a", "description": "E2E tests for @acme/a", "targets": { "e2e": {} }, "implicitDependencies": ["lib-a"] }',
  'e2e/a/package.json':
    '{ "name": "@acme/e2e-a", "description": "E2E tests for @acme/a", "dependencies": { "@acme/a": "file:../../tmp/e2e-packs/acme-a-1.0.0.tgz" } }',
}
const RENAME = { currentProjectName: 'lib-a', newProjectName: 'lib-z', currentPackageName: '@acme/a', newPackageName: '@acme/z' }

describe('e2eProjectOf', () => {
  it('finds the project with an e2e target that depends on the library', () => {
    expect(e2eProjectOf(createMemoryTree(FILES), 'lib-a')?.root).toBe('e2e/a')
  })

  it('answers nothing for a library no e2e project depends on', () => {
    expect(e2eProjectOf(createMemoryTree(FILES), 'lib-b')).toBeUndefined()
  })
})

describe('renameE2eProject', () => {
  it('renames the e2e project after the library', () => {
    const tree = createMemoryTree(FILES)
    renameE2eProject(tree, RENAME)
    expect(readJson(tree, 'e2e/a/project.json')).toEqual({
      name: 'e2e-lib-z',
      description: 'E2E tests for @acme/z',
      targets: { e2e: {} },
      implicitDependencies: ['lib-a'],
    })
  })

  it('renames the e2e package and the tarball it installs after the package', () => {
    const tree = createMemoryTree(FILES)
    renameE2eProject(tree, RENAME)
    expect(readJson(tree, 'e2e/a/package.json')).toEqual({
      name: '@acme/e2e-z',
      description: 'E2E tests for @acme/z',
      dependencies: { '@acme/z': 'file:../../tmp/e2e-packs/acme-z-1.0.0.tgz' },
    })
  })

  it('answers the e2e project root', () => {
    expect(renameE2eProject(createMemoryTree(FILES), RENAME)).toBe('e2e/a')
  })

  it('finds the e2e project under the new name when the references were renamed first', () => {
    const tree = createMemoryTree({
      ...FILES,
      'e2e/a/project.json': '{ "name": "e2e-lib-a", "targets": { "e2e": {} }, "implicitDependencies": ["lib-z"] }',
    })
    renameE2eProject(tree, RENAME)
    expect(readJson<{ name: string }>(tree, 'e2e/a/project.json').name).toBe('e2e-lib-z')
  })

  it('keeps names that do not follow the convention, and manifests without them', () => {
    const tree = createMemoryTree({
      'e2e/a/project.json': '{ "targets": { "e2e": {} }, "implicitDependencies": ["lib-a"] }',
      'e2e/a/package.json': '{ "name": "tests-a", "dependencies": {} }',
    })
    renameE2eProject(tree, RENAME)
    expect({ project: readJson(tree, 'e2e/a/project.json'), pkg: readJson(tree, 'e2e/a/package.json') }).toEqual({
      project: { targets: { e2e: {} }, implicitDependencies: ['lib-a'] },
      pkg: { name: 'tests-a', dependencies: {} },
    })
  })

  it('leaves an e2e project without a package manifest with its project file renamed', () => {
    const tree = createMemoryTree({ 'e2e/a/project.json': FILES['e2e/a/project.json'] })
    renameE2eProject(tree, RENAME)
    expect(tree.listChanges().map((change) => change.path)).toEqual(['e2e/a/project.json'])
  })

  it('answers nothing for a library no e2e project depends on', () => {
    expect(renameE2eProject(createMemoryTree(FILES), { ...RENAME, currentProjectName: 'lib-b', newProjectName: 'lib-y' })).toBeUndefined()
  })
})
