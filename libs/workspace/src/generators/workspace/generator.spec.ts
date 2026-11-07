import { join } from 'node:path'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { readJson } from '../shared/tree'
import { workspaceGenerator } from './generator'

/** This repository's root, where prettier resolves from. */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..')

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

  it('refuses a repository that is a workspace already', async () => {
    await expect(workspaceGenerator(createMemoryTree({ 'hf.json': '{}' }), { skipFormat: true })).rejects.toThrow('hf.json already exists')
  })

  it('formats what it wrote unless asked not to', async () => {
    const tree = createMemoryTree({}, { root: REPO_ROOT })
    await workspaceGenerator(tree)
    expect(tree.read('lint.base.config.ts', 'utf-8')).toContain("import { PROJECTS_FAMILY } from '@hyperfrontend/workspace/lint'")
  })
})
