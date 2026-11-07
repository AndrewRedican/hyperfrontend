import { join } from 'node:path'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readJson } from '../shared/tree'
import { moveGenerator } from './generator'
import { planMove } from './lib/move-helpers'

/** This repository's root, where prettier resolves from. */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..')

const FILES = {
  'tsconfig.base.json':
    '{ "compilerOptions": { "paths": { "@acme/alpha": ["libs/alpha/src/index.ts"], "@acme/beta": ["libs/beta/src/index.ts"] } } }',
  'libs/alpha/project.json':
    '{ "name": "alpha", "description": "The @acme/alpha library", "targets": { "build": { "options": { "iife": { "globalName": "AcmeAlpha" }, "umd": { "globalName": "AcmeAlpha" } } } } }',
  'libs/alpha/package.json': '{ "name": "@acme/alpha", "description": "The @acme/alpha library" }',
  'libs/alpha/README.md': '# @acme/alpha\n',
  'libs/alpha/lint.config.ts': "import baseConfig from '../../lint.base.config.ts'\n",
  'libs/alpha/tsconfig.json': '{ "extends": "../../tsconfig.base.json" }',
  'libs/alpha/tsconfig.lib.json': '{ "compilerOptions": { "outDir": "../../dist/out-tsc" } }',
  'libs/alpha/tsconfig.spec.json': '{ "compilerOptions": {} }',
  'libs/alpha/src/index.ts': '/**\n * @module @acme/alpha\n */\n',
  'libs/beta/project.json': '{ "name": "beta", "implicitDependencies": ["alpha"] }',
  'e2e/alpha/project.json': '{ "name": "e2e-alpha", "targets": { "e2e": {} }, "implicitDependencies": ["alpha"] }',
}

describe('planMove', () => {
  it('names the project and the package after the directory under the destination', () => {
    expect(planMove(createMemoryTree(FILES), { project: 'alpha', destination: 'packages/core' })).toEqual({
      projectName: 'alpha',
      currentProjectRoot: 'libs/alpha',
      newProjectRoot: 'packages/core/alpha',
      newProjectName: 'alpha',
      currentPackageName: '@acme/alpha',
      newPackageName: '@acme/alpha',
      updateName: true,
      newOffsetFromRoot: '../../../',
    })
  })

  it('takes a new directory name, and the project and package names as given', () => {
    expect(
      planMove(createMemoryTree(FILES), {
        project: 'alpha',
        destination: 'packages',
        newName: 'Omega',
        projectName: 'lib-omega',
        packageName: '@acme/om',
      })
    ).toEqual(expect.objectContaining({ newProjectRoot: 'packages/omega', newProjectName: 'lib-omega', newPackageName: '@acme/om' }))
  })

  it('keeps the names when asked to', () => {
    expect(planMove(createMemoryTree(FILES), { project: 'alpha', destination: 'packages', newName: 'omega', updateName: false })).toEqual(
      expect.objectContaining({ newProjectRoot: 'packages/omega', newProjectName: 'alpha', newPackageName: '@acme/alpha' })
    )
  })

  it('plans no package name for a project without a package', () => {
    expect(planMove(createMemoryTree(FILES), { project: 'beta', destination: 'packages' })).toEqual(
      expect.objectContaining({ currentPackageName: undefined, newPackageName: undefined })
    )
  })
})

describe('moveGenerator', () => {
  it('moves every file of the project', async () => {
    const tree = createMemoryTree(FILES)
    await moveGenerator(tree, { project: 'alpha', destination: 'packages', newName: 'omega', skipFormat: true })
    expect(tree.listChanges().map((change) => [change.type, change.path])).toEqual([
      ['UPDATE', 'e2e/alpha/project.json'],
      ['DELETE', 'libs/alpha/lint.config.ts'],
      ['DELETE', 'libs/alpha/package.json'],
      ['DELETE', 'libs/alpha/project.json'],
      ['DELETE', 'libs/alpha/README.md'],
      ['DELETE', 'libs/alpha/src/index.ts'],
      ['DELETE', 'libs/alpha/tsconfig.json'],
      ['DELETE', 'libs/alpha/tsconfig.lib.json'],
      ['DELETE', 'libs/alpha/tsconfig.spec.json'],
      ['UPDATE', 'libs/beta/project.json'],
      ['CREATE', 'packages/omega/lint.config.ts'],
      ['CREATE', 'packages/omega/package.json'],
      ['CREATE', 'packages/omega/project.json'],
      ['CREATE', 'packages/omega/README.md'],
      ['CREATE', 'packages/omega/src/index.ts'],
      ['CREATE', 'packages/omega/tsconfig.json'],
      ['CREATE', 'packages/omega/tsconfig.lib.json'],
      ['CREATE', 'packages/omega/tsconfig.spec.json'],
      ['UPDATE', 'tsconfig.base.json'],
    ])
  })

  it('renames the project, its description and the globals of its browser bundles', async () => {
    const tree = createMemoryTree(FILES)
    await moveGenerator(tree, { project: 'alpha', destination: 'packages', newName: 'omega', skipFormat: true })
    expect(readJson(tree, 'packages/omega/project.json')).toEqual({
      name: 'omega',
      description: 'The @acme/omega library',
      targets: { build: { options: { iife: { globalName: 'AcmeOmega' }, umd: { globalName: 'AcmeOmega' } } } },
    })
  })

  it('points the configuration files at the root from the new depth', async () => {
    const tree = createMemoryTree(FILES)
    await moveGenerator(tree, { project: 'alpha', destination: 'packages/core', skipFormat: true })
    expect({
      lint: tree.read('packages/core/alpha/lint.config.ts', 'utf-8'),
      tsconfig: readJson(tree, 'packages/core/alpha/tsconfig.json'),
      lib: readJson(tree, 'packages/core/alpha/tsconfig.lib.json'),
      spec: readJson(tree, 'packages/core/alpha/tsconfig.spec.json'),
    }).toEqual({
      lint: "import baseConfig from '../../../lint.base.config.ts'\n",
      tsconfig: { extends: '../../../tsconfig.base.json' },
      lib: { compilerOptions: { outDir: '../../../dist/out-tsc' } },
      spec: { compilerOptions: {} },
    })
  })

  it('moves the alias, renames the project where others depend on it, and renames the project that tests it', async () => {
    const tree = createMemoryTree(FILES)
    await moveGenerator(tree, { project: 'alpha', destination: 'packages', newName: 'omega', skipFormat: true })
    expect({
      paths: readJson<{ compilerOptions: { paths: unknown } }>(tree, 'tsconfig.base.json').compilerOptions.paths,
      beta: readJson(tree, 'libs/beta/project.json'),
      e2e: readJson(tree, 'e2e/alpha/project.json'),
      readme: tree.read('packages/omega/README.md', 'utf-8'),
    }).toEqual({
      paths: { '@acme/beta': ['libs/beta/src/index.ts'], '@acme/omega': ['packages/omega/src/index.ts'] },
      beta: { name: 'beta', implicitDependencies: ['omega'] },
      e2e: { name: 'e2e-omega', targets: { e2e: {} }, implicitDependencies: ['omega'] },
      readme: '# @acme/omega\n',
    })
  })

  it('keeps the names and the references when asked to, moving the alias alone', async () => {
    const tree = createMemoryTree(FILES)
    await moveGenerator(tree, { project: 'alpha', destination: 'packages', newName: 'omega', updateName: false, skipFormat: true })
    expect({
      paths: readJson<{ compilerOptions: { paths: unknown } }>(tree, 'tsconfig.base.json').compilerOptions.paths,
      project: readJson<{ name: string }>(tree, 'packages/omega/project.json').name,
      pkg: readJson<{ name: string }>(tree, 'packages/omega/package.json').name,
      beta: readJson(tree, 'libs/beta/project.json'),
    }).toEqual({
      paths: { '@acme/alpha': ['packages/omega/src/index.ts'], '@acme/beta': ['libs/beta/src/index.ts'] },
      project: 'alpha',
      pkg: '@acme/alpha',
      beta: { name: 'beta', implicitDependencies: ['alpha'] },
    })
  })

  it('moves a project without a package, without configuration files, renaming it where others depend on it', async () => {
    const tree = createMemoryTree({ ...FILES, 'libs/gamma/project.json': '{ "name": "gamma", "implicitDependencies": ["beta"] }' })
    await moveGenerator(tree, { project: 'beta', destination: 'packages', newName: 'delta', skipFormat: true })
    expect(tree.listChanges().map((change) => [change.type, change.path])).toEqual([
      ['DELETE', 'libs/beta/project.json'],
      ['UPDATE', 'libs/gamma/project.json'],
      ['CREATE', 'packages/delta/project.json'],
    ])
  })

  it('leaves a workspace without a base tsconfig without an alias to move', async () => {
    const { 'tsconfig.base.json': base, ...files } = FILES
    const tree = createMemoryTree(files)
    await moveGenerator(tree, { project: 'alpha', destination: 'packages', skipFormat: true })
    expect({ base, written: tree.exists('tsconfig.base.json') }).toEqual({ base: expect.any(String), written: false })
  })

  it('refuses the current directory as the destination', async () => {
    await expect(moveGenerator(createMemoryTree(FILES), { project: 'alpha', destination: 'libs', skipFormat: true })).rejects.toThrow(
      'Source and destination cannot be the same'
    )
  })

  it('refuses a destination that exists', async () => {
    await expect(
      moveGenerator(createMemoryTree(FILES), { project: 'alpha', destination: 'libs', newName: 'beta', skipFormat: true })
    ).rejects.toThrow('Destination already exists: libs/beta')
  })

  it('formats what it wrote unless asked not to', async () => {
    const tree = createMemoryTree(FILES, { root: REPO_ROOT })
    await moveGenerator(tree, { project: 'alpha', destination: 'packages' })
    expect(readJson<{ name: string }>(tree, 'packages/alpha/package.json').name).toBe('@acme/alpha')
  })
})
