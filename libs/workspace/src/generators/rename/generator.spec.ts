import { join } from 'node:path'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readJson } from '../shared/tree'
import { planRename, renameGenerator } from './generator'

/** This repository's root, where prettier resolves from. */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..')

const FILES = {
  'tsconfig.base.json':
    '{ "compilerOptions": { "paths": { "@acme/alpha": ["libs/alpha/src/index.ts"], "@acme/beta": ["libs/beta/src/index.ts"] } } }',
  'libs/alpha/project.json': '{ "name": "alpha", "description": "The @acme/alpha library" }',
  'libs/alpha/package.json': '{ "name": "@acme/alpha", "description": "The @acme/alpha library" }',
  'libs/alpha/README.md': '# @acme/alpha\n',
  'libs/alpha/src/index.ts': '/**\n * @module @acme/alpha\n */\n',
  'libs/beta/project.json': '{ "name": "beta", "implicitDependencies": ["alpha"] }',
  'e2e/alpha/project.json': '{ "name": "e2e-alpha", "targets": { "e2e": {} }, "implicitDependencies": ["alpha"] }',
  'e2e/alpha/package.json':
    '{ "name": "@acme/e2e-alpha", "dependencies": { "@acme/alpha": "file:../../tmp/e2e-packs/acme-alpha-0.0.0.tgz" } }',
}

describe('planRename', () => {
  it('names the package after the new name under its scope', () => {
    expect(planRename(createMemoryTree(FILES), { project: 'alpha', newName: 'omega' })).toEqual({
      currentProjectName: 'alpha',
      projectRoot: 'libs/alpha',
      newProjectName: 'omega',
      currentPackageName: '@acme/alpha',
      newPackageName: '@acme/omega',
    })
  })

  it('takes the package name as given', () => {
    expect(planRename(createMemoryTree(FILES), { project: 'alpha', newName: 'omega', packageName: '@other/om' }).newPackageName).toBe(
      '@other/om'
    )
  })

  it('plans no package name for a project without a package', () => {
    expect(planRename(createMemoryTree(FILES), { project: 'beta', newName: 'gamma' })).toEqual(
      expect.objectContaining({ currentPackageName: undefined, newPackageName: undefined })
    )
  })

  it('refuses the current name', () => {
    expect(() => planRename(createMemoryTree(FILES), { project: 'alpha', newName: 'alpha' })).toThrow(
      'New name must be different from current name: alpha'
    )
  })
})

describe('renameGenerator', () => {
  it('renames the project and the package in their manifests', async () => {
    const tree = createMemoryTree(FILES)
    await renameGenerator(tree, { project: 'alpha', newName: 'omega', skipFormat: true })
    expect({ project: readJson(tree, 'libs/alpha/project.json'), pkg: readJson(tree, 'libs/alpha/package.json') }).toEqual({
      project: { name: 'omega', description: 'The @acme/omega library' },
      pkg: { name: '@acme/omega', description: 'The @acme/omega library' },
    })
  })

  it('renames the alias', async () => {
    const tree = createMemoryTree(FILES)
    await renameGenerator(tree, { project: 'alpha', newName: 'omega', skipFormat: true })
    expect(readJson<{ compilerOptions: { paths: unknown } }>(tree, 'tsconfig.base.json').compilerOptions.paths).toEqual({
      '@acme/beta': ['libs/beta/src/index.ts'],
      '@acme/omega': ['libs/alpha/src/index.ts'],
    })
  })

  it('renames the project where others depend on it, and the project that tests it', async () => {
    const tree = createMemoryTree(FILES)
    await renameGenerator(tree, { project: 'alpha', newName: 'omega', skipFormat: true })
    expect({ beta: readJson(tree, 'libs/beta/project.json'), e2e: readJson(tree, 'e2e/alpha/project.json') }).toEqual({
      beta: { name: 'beta', implicitDependencies: ['omega'] },
      e2e: { name: 'e2e-omega', targets: { e2e: {} }, implicitDependencies: ['omega'] },
    })
  })

  it('rewrites the README and the module header', async () => {
    const tree = createMemoryTree(FILES)
    await renameGenerator(tree, { project: 'alpha', newName: 'omega', skipFormat: true })
    expect({ readme: tree.read('libs/alpha/README.md', 'utf-8'), entry: tree.read('libs/alpha/src/index.ts', 'utf-8') }).toEqual({
      readme: '# @acme/omega\n',
      entry: '/**\n * @module @acme/omega\n */\n',
    })
  })

  it('renames a project without a package in its project file and where others depend on it alone', async () => {
    const tree = createMemoryTree({ ...FILES, 'libs/gamma/project.json': '{ "name": "gamma", "implicitDependencies": ["beta"] }' })
    await renameGenerator(tree, { project: 'beta', newName: 'delta', skipFormat: true })
    expect(tree.listChanges().map((change) => change.path)).toEqual(['libs/beta/project.json', 'libs/gamma/project.json'])
  })

  it('leaves a workspace without a base tsconfig without an alias to rename', async () => {
    const { 'tsconfig.base.json': base, ...files } = FILES
    const tree = createMemoryTree(files)
    await renameGenerator(tree, { project: 'alpha', newName: 'omega', skipFormat: true })
    expect({ base, written: tree.exists('tsconfig.base.json') }).toEqual({ base: expect.any(String), written: false })
  })

  it('formats what it wrote unless asked not to', async () => {
    const tree = createMemoryTree(FILES, { root: REPO_ROOT })
    await renameGenerator(tree, { project: 'alpha', newName: 'omega' })
    expect(readJson<{ name: string }>(tree, 'libs/alpha/package.json').name).toBe('@acme/omega')
  })
})
