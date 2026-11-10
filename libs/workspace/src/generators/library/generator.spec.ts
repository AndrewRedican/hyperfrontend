import type { FileTree } from '@hyperfrontend/testing/fs'
import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { createFsTree, createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createRunnerWorkspace } from '../../runner/__test-utils__/workspace'
import { readJson } from '../shared/tree'
import { libraryGenerator, planLibrary } from './generator'

/** This repository's root, where prettier resolves from. */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..')

const ROOT_FILES = {
  'package.json':
    '{ "name": "@acme/monorepo", "license": "MIT", "repository": { "type": "git", "url": "git+https://example.test/acme.git" } }',
  'tsconfig.base.json': '{ "compilerOptions": { "paths": { "@acme/zeta": ["libs/zeta/src/index.ts"] } } }',
}

/** A workspace whose own tooling offers a `make-publishable` that records what it was given. */
const PUBLISHING: FileTree = {
  '.gitignore': 'node_modules\n',
  'hf.json': {},
  'package.json': { name: '@acme/monorepo', private: true },
  'tsconfig.base.json': { compilerOptions: { paths: {} } },
  'tools/local/package.json': { name: '@acme/local', private: true, generators: './generators.json' },
  'tools/local/generators.json': { generators: { 'make-publishable': { factory: './publish', schema: './publish.json' } } },
  'tools/local/publish.js': "export default (tree, options) => { tree.write('published.json', JSON.stringify(options)) }\n",
  'tools/local/publish.json': { properties: {} },
}

const publishing = createRunnerWorkspace(PUBLISHING)
afterAll(() => publishing.remove())

describe('planLibrary', () => {
  it('settles the names from the root manifest and the defaults', () => {
    expect(planLibrary(createMemoryTree(ROOT_FILES), { name: 'MyLib' })).toEqual({
      name: 'my-lib',
      projectName: 'my-lib',
      packageName: '@acme/my-lib',
      projectRoot: 'libs/my-lib',
      description: 'MyLib library.',
      tags: [],
      offsetFromRoot: '../../',
    })
  })

  it('takes the directory, the scope without its @, the project name, the package name, the description and the tags as given', () => {
    expect(
      planLibrary(createMemoryTree(ROOT_FILES), {
        name: 'data',
        directory: 'libs/utils',
        scope: 'other',
        projectName: 'lib-data-utils',
        packageName: '@other/data-utils',
        description: 'Data.',
        tags: ['type:util'],
      })
    ).toEqual({
      name: 'data',
      projectName: 'lib-data-utils',
      packageName: '@other/data-utils',
      projectRoot: 'libs/utils/data',
      description: 'Data.',
      tags: ['type:util'],
      offsetFromRoot: '../../../',
    })
  })

  it('names the package without a scope where the root manifest has none and an empty scope is given', () => {
    expect(planLibrary(createMemoryTree({ 'package.json': '{ "name": "monorepo" }' }), { name: 'core', scope: '' }).packageName).toBe(
      'core'
    )
  })
})

describe('libraryGenerator', () => {
  it('writes the files of the library', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await libraryGenerator(tree, { name: 'alpha', skipFormat: true })
    expect(tree.listChanges().map((change) => change.path)).toEqual([
      'libs/alpha/lint.config.ts',
      'libs/alpha/package.json',
      'libs/alpha/project.json',
      'libs/alpha/README.md',
      'libs/alpha/src/index.ts',
      'libs/alpha/test.config.ts',
      'libs/alpha/tsconfig.json',
      'libs/alpha/tsconfig.lib.json',
      'libs/alpha/tsconfig.spec.json',
      'tsconfig.base.json',
    ])
  })

  it('writes a private manifest with the licence and the repository the root manifest states', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await libraryGenerator(tree, { name: 'alpha', description: 'Alpha.', skipFormat: true })
    expect(readJson(tree, 'libs/alpha/package.json')).toEqual({
      name: '@acme/alpha',
      version: '0.0.0',
      description: 'Alpha.',
      license: 'MIT',
      repository: { type: 'git', url: 'git+https://example.test/acme.git', directory: 'libs/alpha' },
      type: 'module',
      private: true,
      exports: { '.': './src/index.js', './package.json': './package.json' },
    })
  })

  it('writes a manifest without a licence or a repository where the root manifest states none', async () => {
    const tree = createMemoryTree({ ...ROOT_FILES, 'package.json': '{ "name": "@acme/monorepo" }' })
    await libraryGenerator(tree, { name: 'alpha', skipFormat: true })
    expect(readJson(tree, 'libs/alpha/package.json')).toEqual({
      name: '@acme/alpha',
      version: '0.0.0',
      description: 'Alpha library.',
      type: 'module',
      private: true,
      exports: { '.': './src/index.js', './package.json': './package.json' },
    })
  })

  it('copies a repository the root manifest states as one string', async () => {
    const tree = createMemoryTree({ ...ROOT_FILES, 'package.json': '{ "name": "@acme/monorepo", "repository": "github:acme/monorepo" }' })
    await libraryGenerator(tree, { name: 'alpha', skipFormat: true })
    expect(readJson<{ repository: string }>(tree, 'libs/alpha/package.json').repository).toBe('github:acme/monorepo')
  })

  it('writes the project with its tags and the targets the workspace defaults configure', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await libraryGenerator(tree, { name: 'alpha', tags: ['type:util'], skipFormat: true })
    expect(readJson(tree, 'libs/alpha/project.json')).toEqual({
      name: 'alpha',
      description: 'Alpha library.',
      sourceRoot: '{projectRoot}/src',
      projectType: 'library',
      tags: ['type:util'],
      targets: { typecheck: {}, test: {}, build: { options: { esm: {}, cjs: {} } } },
    })
  })

  it('adds the alias of the package among the others', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await libraryGenerator(tree, { name: 'alpha', skipFormat: true })
    expect(readJson<{ compilerOptions: { paths: unknown } }>(tree, 'tsconfig.base.json').compilerOptions.paths).toEqual({
      '@acme/alpha': ['libs/alpha/src/index.ts'],
      '@acme/zeta': ['libs/zeta/src/index.ts'],
    })
  })

  it('points the configuration files at the root from the library depth', async () => {
    const tree = createMemoryTree(ROOT_FILES)
    await libraryGenerator(tree, { name: 'data', directory: 'libs/utils', skipFormat: true })
    expect({
      lint: tree.read('libs/utils/data/lint.config.ts', 'utf-8'),
      tsconfig: readJson<{ extends: string }>(tree, 'libs/utils/data/tsconfig.json').extends,
    }).toEqual({ lint: expect.stringContaining("from '../../../lint.base.config.ts'"), tsconfig: '../../../tsconfig.base.json' })
  })

  it('hands a publishable library to the generator named make-publishable with the options it takes', async () => {
    const tree = createFsTree(publishing.path)
    await libraryGenerator(tree, { name: 'alpha', publishable: true, keywords: ['k'], formats: ['esm'], skipFormat: true })
    expect(readJson(tree, 'published.json')).toEqual({ project: 'alpha', keywords: ['k'], formats: ['esm'], skipFormat: true })
  })

  it('hands on no option it was not given', async () => {
    const tree = createFsTree(publishing.path)
    await libraryGenerator(tree, { name: 'beta', publishable: true, skipFormat: true })
    expect(readJson(tree, 'published.json')).toEqual({ project: 'beta', skipFormat: true })
  })

  it('formats what it wrote unless asked not to', async () => {
    const tree = createMemoryTree(ROOT_FILES, { root: REPO_ROOT })
    await libraryGenerator(tree, { name: 'alpha' })
    expect(tree.read('libs/alpha/lint.config.ts', 'utf-8')).toContain("import baseConfig from '../../lint.base.config.ts'")
  })
})
