import { join, posix } from 'node:path'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readJson } from '../shared/tree'
import { workspaceGenerator } from './generator'

/** This repository's root, where prettier resolves from. */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..')

/** The Node.js type declarations range the generator names: the major of the running Node.js. */
const NODE_TYPES_RANGE = `^${process.versions.node.split('.')[0]}.0.0`

describe('workspaceGenerator', () => {
  it('writes the root configuration the engine reads', async () => {
    const tree = createMemoryTree()
    await workspaceGenerator(tree, { skipFormat: true })
    expect(tree.listChanges().map((change) => change.path)).toEqual([
      '.gitignore',
      '.hfignore',
      'hf.json',
      'lint.base.config.ts',
      'tsconfig.base.json',
    ])
  })

  it('names the packaged executors in the target defaults', async () => {
    const tree = createMemoryTree()
    await workspaceGenerator(tree, { skipFormat: true })
    expect(readJson<{ targetDefaults: Record<string, { executor: string }> }>(tree, 'hf.json').targetDefaults).toEqual({
      typecheck: expect.objectContaining({ executor: '@hyperfrontend/workspace:typecheck' }),
      test: expect.objectContaining({ executor: '@hyperfrontend/workspace:test' }),
      build: expect.objectContaining({ executor: '@hyperfrontend/workspace:build' }),
      publish: expect.objectContaining({ executor: '@hyperfrontend/workspace:publish' }),
      e2e: expect.objectContaining({ executor: '@hyperfrontend/workspace:e2e' }),
      version: expect.objectContaining({ executor: '@hyperfrontend/workspace:version' }),
      'version-check': expect.objectContaining({ executor: '@hyperfrontend/workspace:version-check' }),
    })
  })

  it('ignores what the engine, the builds and the test runs write in a repository without a .gitignore', async () => {
    const tree = createMemoryTree({})
    await workspaceGenerator(tree, { skipFormat: true })
    expect(tree.read('.gitignore', 'utf-8')).toBe('node_modules\ndist\ntmp\ncoverage\n.hf\n')
  })

  it('keeps a .gitignore the repository already has', async () => {
    const tree = createMemoryTree({ '.gitignore': 'mine\n' })
    await workspaceGenerator(tree, { skipFormat: true })
    expect(tree.read('.gitignore', 'utf-8')).toBe('mine\n')
  })

  it('makes the root manifest an ES module package with the Node.js type declarations the configurations name', async () => {
    const tree = createMemoryTree({
      'package.json': '{ "name": "consumer", "type": "commonjs", "devDependencies": { "prettier": "^3.0.0" } }',
    })
    await workspaceGenerator(tree, { skipFormat: true })
    expect(readJson(tree, 'package.json')).toEqual({
      name: 'consumer',
      type: 'module',
      devDependencies: { '@types/node': NODE_TYPES_RANGE, prettier: '^3.0.0' },
    })
  })

  it('keeps the Node.js type declarations range the root manifest already states', async () => {
    const tree = createMemoryTree({ 'package.json': '{ "name": "consumer", "devDependencies": { "@types/node": "^22.0.0" } }' })
    await workspaceGenerator(tree, { skipFormat: true })
    expect(readJson<{ devDependencies: Record<string, string> }>(tree, 'package.json').devDependencies).toEqual({
      '@types/node': '^22.0.0',
    })
  })

  it('refuses a repository that is a workspace already', async () => {
    await expect(workspaceGenerator(createMemoryTree({ 'hf.json': '{}' }), { skipFormat: true })).rejects.toThrow('hf.json already exists')
  })

  it('writes no hook configuration unless asked to', async () => {
    const tree = createMemoryTree()
    await workspaceGenerator(tree, { skipFormat: true })
    expect(tree.exists('hooks.config.ts')).toBe(false)
  })

  it('writes a first hook configuration and ignores the local file of a clone when asked for hooks', async () => {
    const tree = createMemoryTree()
    await workspaceGenerator(tree, { hooks: true, skipFormat: true }, {})
    expect([tree.exists('hooks.config.ts'), tree.read('.gitignore', 'utf-8')]).toEqual([
      true,
      'node_modules\ndist\ntmp\ncoverage\n.hf\nhooks.local.config.ts\n',
    ])
  })

  it('installs the stubs of the first configuration where the tree is the root of a repository', async () => {
    const tree = createMemoryTree({}, { root: REPO_ROOT })
    await workspaceGenerator(tree, { hooks: true, skipFormat: true }, {})
    expect(
      tree
        .listChanges()
        .filter((change) => change.path.split(posix.sep)[0] === '.git')
        .map((change) => change.path)
    ).toEqual(['.git/hooks/pre-commit', '.git/hooks/pre-push'])
  })

  it('installs no stub under CI', async () => {
    const tree = createMemoryTree({}, { root: REPO_ROOT })
    await workspaceGenerator(tree, { hooks: true, skipFormat: true }, { CI: '1' })
    expect(tree.listChanges().filter((change) => change.path.split(posix.sep)[0] === '.git')).toEqual([])
  })

  it.each([
    ['a manifest without scripts', '{ "name": "consumer" }', 'hf generate hooks'],
    ['a prepare script of its own', '{ "name": "consumer", "scripts": { "prepare": "husky" } }', 'husky && hf generate hooks'],
    [
      'a prepare script that installs them already',
      '{ "name": "consumer", "scripts": { "prepare": "hf generate hooks && husky" } }',
      'hf generate hooks && husky',
    ],
  ])('has the root manifest install the hooks on every install when asked, given %s', async (_, manifest, prepare) => {
    const tree = createMemoryTree({ 'package.json': manifest })
    await workspaceGenerator(tree, { hooks: true, prepare: true, skipFormat: true }, {})
    expect(readJson<{ scripts: Record<string, string> }>(tree, 'package.json').scripts).toEqual({ prepare })
  })

  it('adds no script to the root manifest for hooks alone', async () => {
    const tree = createMemoryTree({ 'package.json': '{ "name": "consumer" }' })
    await workspaceGenerator(tree, { hooks: true, skipFormat: true }, {})
    expect(readJson<{ scripts?: unknown }>(tree, 'package.json').scripts).toBeUndefined()
  })

  it.each([
    ['without hooks', { prepare: true }, { 'package.json': '{}' }],
    ['without a root manifest', { prepare: true, hooks: true }, {}],
  ])('refuses the prepare script %s', async (_, options, files) => {
    await expect(workspaceGenerator(createMemoryTree(files), { ...options, skipFormat: true }, {})).rejects.toThrow(
      '--prepare adds a script to the root package.json beside --hooks'
    )
  })

  it('formats what it wrote unless asked not to', async () => {
    const tree = createMemoryTree({}, { root: REPO_ROOT })
    await workspaceGenerator(tree)
    expect(tree.read('lint.base.config.ts', 'utf-8')).toContain("import { PROJECTS_FAMILY } from '@hyperfrontend/workspace/lint'")
  })
})
