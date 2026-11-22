import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { assertE2eRenameFree, e2eProjectsOf, renameE2eProjects } from './e2e-project'
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

/** A library two projects test: one named after it and, before it in path order, one that tests a sibling beside it. */
const TWO = {
  'libs/a/project.json': '{ "name": "lib-a" }',
  'e2e/a-ui/project.json':
    '{ "name": "e2e-lib-a-ui", "description": "E2E tests for @acme/a-ui over @acme/a", "targets": { "e2e": {} }, "implicitDependencies": ["lib-a-ui", "lib-a"] }',
  'e2e/a-ui/package.json':
    '{ "name": "@acme/e2e-a-ui", "dependencies": { "@acme/a-ui": "file:../../tmp/e2e-packs/acme-a-ui-2.0.0.tgz", "@acme/a": "file:../../tmp/e2e-packs/acme-a-1.0.0.tgz" } }',
  'tests/a/project.json': FILES['e2e/a/project.json'],
  'tests/a/package.json': FILES['e2e/a/package.json'],
}

describe('e2eProjectsOf', () => {
  it('finds the project with an e2e target that depends on the library', () => {
    expect(e2eProjectsOf(createMemoryTree(FILES), ['lib-a']).map((project) => project.root)).toEqual(['e2e/a'])
  })

  it('finds every such project when several depend on the library', () => {
    expect(e2eProjectsOf(createMemoryTree(TWO), ['lib-a']).map((project) => project.root)).toEqual(['e2e/a-ui', 'tests/a'])
  })

  it('answers none for a library no e2e project depends on', () => {
    expect(e2eProjectsOf(createMemoryTree(FILES), ['lib-b'])).toEqual([])
  })
})

describe('renameE2eProjects', () => {
  it('renames the e2e project after the library', () => {
    const tree = createMemoryTree(FILES)
    renameE2eProjects(tree, RENAME)
    expect(readJson(tree, 'e2e/a/project.json')).toEqual({
      name: 'e2e-lib-z',
      description: 'E2E tests for @acme/z',
      targets: { e2e: {} },
      implicitDependencies: ['lib-a'],
    })
  })

  it('renames the e2e package and the tarball it installs after the package', () => {
    const tree = createMemoryTree(FILES)
    renameE2eProjects(tree, RENAME)
    expect(readJson(tree, 'e2e/a/package.json')).toEqual({
      name: '@acme/e2e-z',
      description: 'E2E tests for @acme/z',
      dependencies: { '@acme/z': 'file:../../tmp/e2e-packs/acme-z-1.0.0.tgz' },
    })
  })

  it('answers the e2e project roots', () => {
    expect(renameE2eProjects(createMemoryTree(FILES), RENAME)).toEqual(['e2e/a'])
  })

  it('finds the e2e project under the new name when the references were renamed first', () => {
    const tree = createMemoryTree({
      ...FILES,
      'e2e/a/project.json': '{ "name": "e2e-lib-a", "targets": { "e2e": {} }, "implicitDependencies": ["lib-z"] }',
    })
    renameE2eProjects(tree, RENAME)
    expect(readJson<{ name: string }>(tree, 'e2e/a/project.json').name).toBe('e2e-lib-z')
  })

  it('renames the project named after the library wherever it stands among those that test it', () => {
    const tree = createMemoryTree(TWO)
    renameE2eProjects(tree, RENAME)
    expect({ project: readJson(tree, 'tests/a/project.json'), pkg: readJson(tree, 'tests/a/package.json') }).toEqual({
      project: { name: 'e2e-lib-z', description: 'E2E tests for @acme/z', targets: { e2e: {} }, implicitDependencies: ['lib-a'] },
      pkg: {
        name: '@acme/e2e-z',
        description: 'E2E tests for @acme/z',
        dependencies: { '@acme/z': 'file:../../tmp/e2e-packs/acme-z-1.0.0.tgz' },
      },
    })
  })

  it('brings a project that tests the library beside another along under its own names', () => {
    const tree = createMemoryTree(TWO)
    renameE2eProjects(tree, RENAME)
    expect({ project: readJson(tree, 'e2e/a-ui/project.json'), pkg: readJson(tree, 'e2e/a-ui/package.json') }).toEqual({
      project: {
        name: 'e2e-lib-a-ui',
        description: 'E2E tests for @acme/a-ui over @acme/z',
        targets: { e2e: {} },
        implicitDependencies: ['lib-a-ui', 'lib-a'],
      },
      pkg: {
        name: '@acme/e2e-a-ui',
        dependencies: {
          '@acme/a-ui': 'file:../../tmp/e2e-packs/acme-a-ui-2.0.0.tgz',
          '@acme/z': 'file:../../tmp/e2e-packs/acme-z-1.0.0.tgz',
        },
      },
    })
  })

  it('answers every root it brought along, in path order', () => {
    expect(renameE2eProjects(createMemoryTree(TWO), RENAME)).toEqual(['e2e/a-ui', 'tests/a'])
  })

  it.each([
    ['a directory that repeats the stem', 'file:../../acme-a-packs/acme-a-1.0.0.tgz', 'file:../../acme-a-packs/acme-z-1.0.0.tgz'],
    [
      'a directory named after a longer package',
      'file:../../dist/acme-a-ui/acme-a-1.0.0-beta.1.tgz',
      'file:../../dist/acme-a-ui/acme-z-1.0.0-beta.1.tgz',
    ],
    ['no directory', 'file:acme-a-1.0.0.tgz', 'file:acme-z-1.0.0.tgz'],
    ['the tarball of a longer package', 'file:../../tmp/e2e-packs/acme-a-ui-1.0.0.tgz', 'file:../../tmp/e2e-packs/acme-a-ui-1.0.0.tgz'],
    ['the tarball of another package', 'file:../../tmp/e2e-packs/acme-b-1.0.0.tgz', 'file:../../tmp/e2e-packs/acme-b-1.0.0.tgz'],
    ['a version, not a tarball', '^1.0.0', '^1.0.0'],
    ['a path through a directory of the stem alone', 'file:../../acme-a-1/package', 'file:../../acme-a-1/package'],
  ])('rewrites the stem in the name of the tarball alone, for a pin with %s', (_case, pin, expected) => {
    const tree = createMemoryTree({
      'e2e/a/project.json': FILES['e2e/a/project.json'],
      'e2e/a/package.json': `{ "name": "@acme/e2e-a", "dependencies": { "@acme/a": "${pin}" } }`,
    })
    renameE2eProjects(tree, RENAME)
    expect(readJson<{ dependencies: Record<string, string> }>(tree, 'e2e/a/package.json').dependencies).toEqual({ '@acme/z': expected })
  })

  it('keeps names that do not follow the convention, and manifests without them', () => {
    const tree = createMemoryTree({
      'e2e/a/project.json': '{ "targets": { "e2e": {} }, "implicitDependencies": ["lib-a"] }',
      'e2e/a/package.json': '{ "name": "tests-a", "dependencies": {} }',
    })
    renameE2eProjects(tree, RENAME)
    expect(tree.listChanges()).toEqual([])
  })

  it('leaves an e2e project without a package manifest with its project file renamed', () => {
    const tree = createMemoryTree({ 'e2e/a/project.json': FILES['e2e/a/project.json'] })
    renameE2eProjects(tree, RENAME)
    expect(tree.listChanges().map((change) => change.path)).toEqual(['e2e/a/project.json'])
  })

  it('answers none for a library no e2e project depends on', () => {
    expect(renameE2eProjects(createMemoryTree(FILES), { ...RENAME, currentProjectName: 'lib-b', newProjectName: 'lib-y' })).toEqual([])
  })
})

describe('assertE2eRenameFree', () => {
  it('passes a rename whose test project and package take names nothing holds', () => {
    expect(() => assertE2eRenameFree(createMemoryTree(FILES), RENAME)).not.toThrow()
  })

  it('passes a rename no project tests', () => {
    expect(() => assertE2eRenameFree(createMemoryTree(FILES), { ...RENAME, currentProjectName: 'lib-b' })).not.toThrow()
  })

  it('refuses a rename whose test project would take the name another project holds', () => {
    const tree = createMemoryTree({ ...FILES, 'tools/x/project.json': '{ "name": "e2e-lib-z" }' })
    expect(() => assertE2eRenameFree(tree, RENAME)).toThrow("Project name already in use: 'e2e-lib-z' is the project at tools/x")
  })

  it("refuses a rename whose test project's package would take the name another package holds", () => {
    const tree = createMemoryTree({
      ...FILES,
      'tools/x/project.json': '{ "name": "x" }',
      'tools/x/package.json': '{ "name": "@acme/e2e-z" }',
    })
    expect(() => assertE2eRenameFree(tree, RENAME)).toThrow("Package name already in use: '@acme/e2e-z' is the package at tools/x")
  })

  it('passes test projects whose names do not follow the convention, held as the new names may be', () => {
    const tree = createMemoryTree({
      'libs/a/project.json': '{ "name": "lib-a" }',
      'tests/a/project.json': '{ "name": "checks", "targets": { "e2e": {} }, "implicitDependencies": ["lib-a"] }',
      'tests/a/package.json': '{ "name": "@acme/checks" }',
      'tools/x/project.json': '{ "name": "e2e-lib-z" }',
      'tools/x/package.json': '{ "name": "@acme/e2e-z" }',
    })
    expect(() => assertE2eRenameFree(tree, RENAME)).not.toThrow()
  })

  it('passes a test project without a package manifest', () => {
    const tree = createMemoryTree({
      'libs/a/project.json': FILES['libs/a/project.json'],
      'e2e/a/project.json': FILES['e2e/a/project.json'],
    })
    expect(() => assertE2eRenameFree(tree, RENAME)).not.toThrow()
  })

  it('passes a rename whose test project and package take the names the library leaves', () => {
    const tree = createMemoryTree({
      'tsconfig.base.json': '{ "compilerOptions": { "paths": { "@acme/e2e-b": ["libs/b/src/index.ts"] } } }',
      'libs/b/project.json': '{ "name": "e2e-b" }',
      'libs/b/package.json': '{ "name": "@acme/e2e-b" }',
      'e2e/b/project.json': '{ "name": "e2e-e2e-b", "targets": { "e2e": {} }, "implicitDependencies": ["e2e-b"] }',
      'e2e/b/package.json': '{ "name": "@acme/e2e-e2e-b" }',
    })
    expect(() =>
      assertE2eRenameFree(tree, {
        currentProjectName: 'e2e-b',
        newProjectName: 'b',
        currentPackageName: '@acme/e2e-b',
        newPackageName: '@acme/b',
      })
    ).not.toThrow()
  })
})
